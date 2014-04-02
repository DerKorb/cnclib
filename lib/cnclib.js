var renderer, scene, scene, camera, stats, controls, codeEditor;

function rad( deg )
{
	return deg / 180 * Math.PI;
}

function cnclib(userOptions)
{
	var program = [];
	
	this.options = { z_safe: 2, nPathTrials: 1000000, drillClockwise: true, maxVSpeed: 100, maxHSpeed: 400, stepFactor: 0.75, stepFactorDrill: 0.375, stepFactorZ: 0.25, dipSpeed: 100, maxJogSpeed: 900 };
	var parts = [];
	var that = this;
	var G1 = 1, G0 = 0, G2 = 2, G3 = 3;
	this.outlines = [];

	// load user options
	for (var prop in userOptions)
	{
		if (!userOptions.hasOwnProperty(prop))
			continue;
	
		this.options[prop] = userOptions[prop];
	}
	
	function command(cmd) 
	{
		var cpy = {};
		for (p in cmd)
		{
			if (!cmd.hasOwnProperty(p))
				continue;
				
			cpy[p] = cmd[p];
		}
		
		currentPart.commands.push(cpy);
	}
	
	function straightFeed(obj, add) 
	{
		for (var p in add)
			obj[p] = add[p];
	
		obj.type = G1;
		command(obj);
	}
	
	this.line = function(param)
	{
		straightFeed(param);
	}
	
	function feed(obj, add) 
	{
		for (var p in add)
			obj[p] = add[p];
			
		obj.type = G0;
		command(obj);
	}
	
	function ProtoPart(pointIn)
	{
		this.commands = [];
		this.requires = [];
		this.endPoints = [ pointIn ];
	}
	
	var currentPart = new ProtoPart( false );
	feed({ z: this.options.z_safe });
	
	this.startPart = function(pointIn, requires)
	{
		if (currentPart.commands.length < 2) // feed first
		{
			currentPart.endPoints[0] = pointIn;
			currentPart.requires = requires;
			return;
		}
		
		parts.push(currentPart);
		
		currentPart = new ProtoPart(pointIn);
		currentPart.type = "unknown";
		currentPart.requires = requires;
		feed({ z: this.options.z_safe });
	}
	
	this.interpolate = function(limits, resolution, f)
	{
		var dl = Math.abs(limits[1] - limits[0]);
	
		for (var p = 0; p < dl; p += resolution)
		{
			f((limits[1] > limits[0] ? limits[0] + p : limits[0] - p), limits, resolution);
		}
	}
	
	this.radial = function(radius, angle, f)
	{
		for (var i = 0; i <= 360 - angle; i += angle)
		{
			var x = Math.cos(i / 180 * Math.PI) * radius;
			var y = Math.sin(i / 180 * Math.PI) * radius;
			
			f(x, y, i);
		}
	}
	
	this.symmetric = function(f)
	{
		var fn = f.toString().split("{")[0];
		if (fn.toLowerCase().match(/[xy]+/ig).indexOf("x") != -1 && fn.toLowerCase().match(/[xy]+/ig).indexOf("y") != -1)
		{
			f(-1,-1);
			f(-1,1);
			f(1,1);
			f(1,-1);
		}
		else if(f.toString().toLowerCase().match(/[xy]+/ig).indexOf("x") !=-1 || f.toString().toLowerCase().match(/[xy]+/ig).indexOf("y")!=-1)
		{
			f(-1);
			f(1);
		}
	}
	
	this.customPart = function(f)
	{
		this.startPart();
		f({straightFeed: straightFeed, feed: feed});
		currentPart.endPoints[0] = currentPart.commands[0];
		this.endPart(currentPart.commands[currentPart.commands.length-1]);
	}
	
	this.endPart = function(pointOut)
	{
		currentPart.endPoints[1] = pointOut;
		this.startPart();
		return parts.length - 1;
	}
	
	this.toText = function() 
	{
		w = window.open();
		w.document.write("<pre>");
		var text = "%\n(enable spindle)\nM03 S1\n\n(precise mode)\nG61\n\n(cutter diameter: "+mill+")\n";
		
		function partToGCode(part)
		{
			if (part.type == "drill")
				text += "(drilling hole)\n";

			else if (part.type == "rect")
				text += "(milling rectangle w: " + part.params.width + ", h: " + part.params.height + ")\n";

			else if (part.type == "line")
				text += "(milling polyline)\n";

			part.commands.forEach(function(command)
			{
				c = command;
				var line = "G"+command.type;
				delete c.type;
				for (key in c)
					if (c[key] != undefined)
						line += " "+key.replace("speed", "f").toUpperCase()+sanitize(c[key]);
				text+=line+"\n";
			});
		
			text+="\n";
		}
		
		if (bestPartOrder)
		for (var i = 0; i < bestPartOrder.length; i++)
		{
			var partID = bestPartOrder[i];
			partToGCode(parts[partID]);
		}
		
		else
			parts.forEach(partToGCode);

		w.document.write(text+"%<pre>");
	}
	
	var heeksStyle = 
	{
		G1: new THREE.LineDashedMaterial({ color: 0x00FF00, dashSize: 1, gapSize: 0.5}), 
		G0: new THREE.LineBasicMaterial({color: 0xFF0000}),
		arrowColor: 0xff6666,
		outline: new THREE.LineBasicMaterial({color: 0x0000ff}), 
		outline2: new THREE.LineBasicMaterial({color: 0x8888ff}), 
		partMaterial: new THREE.MeshNormalMaterial({transparent: true, color: "orange", opacity: 0.2})
	};
	
	var linuxCncStyle = 
	{
		G1: new THREE.LineBasicMaterial({color: 0xFFFFFF}), 
		G0: new THREE.LineDashedMaterial({color: "lightblue", dashSize: 1, gapSize: 0.5}),
		arrowColor: "blue",
		outline: new THREE.LineBasicMaterial({color: 0x0000ff, dashSize: 1, gapSize: 0}), 
		outline2: new THREE.LineBasicMaterial({color: 0x8888ff, dashSize: 1, gapSize: 0}), 
		partMaterial: new THREE.MeshNormalMaterial({transparent: true, color: "orange", opacity: 0.2})
	};
	
	var materials = {};
	coloredMaterial = function(color)
	{
		if (!materials[color])
			materials[color] = new THREE.MeshBasicMaterial({color: color});
		
		return materials[color];
	}
	
	var currentStyle = heeksStyle;
	
	var _x = false, _y = false, _z = false, _f = false;
	
	this.min = {x:10000, y: 10000, z: 10000};
	this.max = {x:-10000, y: -10000, z: -10000};
	
	function update(command)
	{
		if (typeof(command.x) == "number")
			_x = command.x;
		if (typeof(command.y) == "number")
			_y = command.y;
		if (typeof(command.z) == "number")
			_z = command.z;
		if (typeof(command.speed) == "number")
			_f = command.speed;

		if (_x > that.max.x) that.max.x = _x;
		if (_y > that.max.y) that.max.y = _y;
		if (_z > that.max.z) that.max.z = _z;
		if (_x < that.min.x) that.min.x = _x;
		if (_y < that.min.y) that.min.y = _y;
		if (_z < that.min.z) that.min.z = _z;
	}
	
	var totalCutTime = 0, totalJogTime = 0;
	function time()
	{
		_x = false;
		_y = false;
		_z = false;
		_f = false;
		totalCutTime = 0;
		parts.forEach(function(part) 
		{
			part.commands.forEach(function(command)
			{
				switch (command.type) 
				{
					case G0:
					case G1:
						ox = _x;
						oy = _y;
						oz = _z;
						update(command);
						if (ox==false)
							break;
						dist = Math.sqrt(
							(ox-_x)*(ox-_x)
							+(oy-_y)*(oy-_y)
							+(oz-_z)*(oz-_z));
						console.assert(command.type == G0 || _f != 0, "speed is zero", command, part);
						//console.log(dist,command.type, _f, dist / (command.type == G0 ? that.options.maxJogSpeed : _f));
						totalCutTime += dist / (command.type == G0 ? that.options.maxJogSpeed : _f);
						break;
					case G2:
					case G3:
						update(command);					

						var r = Math.sqrt(	(command.i == undefined ? 0 : Math.pow(command.i, 2)) +
											(command.j == undefined ? 0 : Math.pow(command.j, 2)) +  
											(command.k == undefined ? 0 : Math.pow(command.k, 2)));
						
						var p = command.p == undefined ? 1 : command.p;
						//console.log(r, p, _f, Math.PI * 2 * r * p / _f);
						totalCutTime += Math.PI * 2 * r * p / _f;
						break;
						
					default:
						break;
				}
			});
		});
	}
	
	function updateTimeDisplay()
	{
		var t = totalCutTime + totalJogTime;
		var mins = Math.floor(t);
		var secs = Math.floor((t * 60) % 60);
		$("#time").html("<font color=\"darkgreen\">Estimated run time <font color=\"orange\">" + mins + " minutes " + secs + " seconds</font></font>");
	}

	var X = 1, Y = 2, Z = 3;
	function arrow(axis, color)
	{
		Arrow = new THREE.Object3D();
		var tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 2, 10, 10, false), coloredMaterial(color));
		tip.position.y = 5;
		tip.overdraw = true;
		Arrow.add(tip);
		var base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 10, 10, false), coloredMaterial(color));
		base.position.y = 2.5
		base.overdraw = true;
		Arrow.add(base);
		scene.add(Arrow);
		if (axis==Y)
			Arrow.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI/2);
		if (axis==Z)
			Arrow.rotateOnAxis(new THREE.Vector3(0, 0, 1), -Math.PI/2);
	}
		
	this.dipIn = function(z, param)
	{
		var speed = this.options.dipSpeed;
		if (param.dipSpeed != undefined)
			speed = param.dipSpeed;
		
		console.assert(speed > 0, "dipping into material without speed setting!");
		straightFeed( { z: z, speed: speed } );
	}
	
	function basicParamCheck(param, type)
	{
		console.assert(type == "drill" || type == "rect" || type == "line", "Invalid call to basicParamCheck", type);
		
		var span = type == "drill" ? 2 * param["radius"] : param["span"];
		console.assert(param.depth != undefined, "No depth for hole specified", param);

		if (param.fineEdge == undefined)
			param.fineEdge = that.options.fineEdge;
		
		if (param.fineEdge == undefined || param.width < mill + param.fineEdge * 2 || param.height < mill + param.fineEdge * 2)
			param.fineEdge = 0;
			
		if (param.fineSpeed == undefined)
			param.fineSpeed = that.options.fineSpeed;
			
		if (param.speed == undefined)
			param.speed = that.options.defaultSpeed;
			
		if (type != "line" && span != 0)
		{
			// xy Steps
			if (param.outlineOnly)
				param.stepSize = span / 2 - param.fineEdge; // outline only: only cut outermost trace -> nSteps = 1
		
			if (!param.stepSize && !param.nSteps && !param.stepFactor)
				param.stepFactor = type == "drill" ? that.options.stepFactorDrill : that.options.stepFactor;
			
			if (!param.stepSize && !param.nSteps && param.stepFactor)
			{
				console.assert(param.stepFactor > 0 && param.stepFactor <= 1, "stepFactor needs to lie inbetween 0 and 1 (including)", param);
				param.stepSize = mill * param.stepFactor;
			}
		
			if (param.nSteps != undefined)
				console.assert(span / param.nSteps <= mill, "Not enough steps in hole", param);
		
			console.log(param.stepSize);
			if (param.nSteps == undefined)
				param.nSteps = Math.ceil((span - 2 * param.fineEdge) / param.stepSize * (type == "drill" ? 0.5 : 1)) * (type == "drill" ? 1 : 0.5);

			console.assert(param.nSteps != 0, "Invalid number of steps", param);
			
			param.stepSize = (span - 2 * param.fineEdge) / Math.floor(2 * param.nSteps);
			console.assert(param.outlineOnly || param.stepSize < mill, "Steps too big for tool", param);
		}
		
		// z Parameters
		console.assert(param.depth > 0, "objects need to have a positive depth", param);
		
		if (param.z0 == undefined)
			param.z0 = 0;
			
		console.assert(param.z0 <= 0, "objects need to be below the surface of your material", param);

		if (type != "drill" || span != 0)
		{
			// z Steps
			if (!param.stepSizeZ && !param.nStepsZ && !param.stepFactorZ)
			{
				if (!that.options.stepSizeZ)
					param.stepFactorZ = that.options.stepFactorZ;
				
				else
					param.stepSizeZ = that.options.stepSizeZ;
			}
			
			if (!param.stepSizeZ && !param.nStepsZ && param.stepFactorZ)
			{
				console.assert(param.stepFactorZ > 0, "stepFactorZ cannot be negative", param);
				param.stepSizeZ = mill * param.stepFactorZ;
			}
		
			if (param.nStepsZ == undefined)
				param.nStepsZ = Math.ceil(param.depth / param.stepSizeZ);
			
			console.assert(param.nStepsZ != 0, "Invalid number of steps in z direction", param);
			
			param.stepSizeZ = param.depth / param.nStepsZ;
		}
	}
	
	function rotX( x, y, rp )
	{
		if (rp.angle == undefined) return x;
	
		return x * Math.cos(rp.angle) - y * Math.sin(rp.angle)
	}
	
	function rotY( x, y, rp )
	{
		if (rp.angle == undefined) return y;
	
		return x * Math.sin(rp.angle) + y * Math.cos(rp.angle);
	}
	
	function rotP( p, rp )
	{
		return { x: rp.cx + rotX( p.x - rp.cx, p.y - rp.cy, rp ), y: rp.cy + rotY( p.x - rp.cx, p.y - rp.cy, rp ) };
	}
	
	function addP( p1, p2 )
	{
		return { x: p1.x + p2.x, y: p1.y + p2.y };	
	}
	
	this.line = function(param)
	{
		param.nSteps = 1;
		currentPart.type = "line";
		currentPart.param = param;
		
		// param: points, depth, nStep
		basicParamCheck(param, "line");
		
		var points = param.points;
		var dir = 1;

		var p0 = { x: points[0][0], y: points[0][1] };
		this.startPart(p0, param.requires);
		feed(p0);
		
		// cut the line
		for (var z = param.z0 - param.stepSizeZ; z >= param.z0 - param.depth; z -= param.stepSizeZ)
		{
			this.dipIn(z, param);
			
			for (var i = 0; i < points.length; i++)
			{
				var j = dir ? i : (points.length - i - 1);
				straightFeed({ x: points[j][0], y: points[j][1], speed: param.speed });
			}
			
			dir ^= 1;
		}

		return this.endPart(dir ? p0 : { x: points[points.length - 1][0], y: points[points.length - 1][1] });
	}
	
	this.rect = function(param, children) 
	{
		// parameter calculation
		if (param.side != undefined)
		{
			param.width = param.side;
			param.height = param.side;
		}
		
		if (param.x1 != undefined && param.y1 != undefined)
		{
			if (param.x2 != undefined && param.y2 != undefined)
			{
				param.width = param.x2 - param.x1;
				param.height = param.y2 - param.y1;
			}
			
			console.assert(param.width != undefined && param.height != undefined, "Missing parameters (width/height or x2/y2)");

			param.x = param.x1 + param.width / 2;
			param.y = param.y1 + param.height / 2;
			
			if (param.width < 0)
				param.width = -param.width;
				
			if (param.height < 0)
				param.height = -param.height;
		}
		
		if (param.x == undefined) param.x = 0;
		if (param.y == undefined) param.y = 0;
		
		console.assert(param.width > mill && param.height > mill, "Rectangle too small");
		
		if (!param.inline)
		{
			param.width -= mill;
			param.height -= mill;
		}
		else
		{
			param.width += mill;
			param.height += mill;
		}
			
		var extendCorners = (this.options.extendCorners && param.extendCorners == undefined) || param.extendCorners;
		param.extendCorners = extendCorners;
		
		var portrait = param.width < param.height;
		var spine = Math.abs(param.width - param.height);
		var span = !portrait ? param.height : param.width;
		
		param.span = span;
		basicParamCheck(param, "rect");
		
		if (param.rotation != undefined)
			console.assert(param.rotation <= Math.PI * 2, "Requested rotation is more than 360°. Please use radian values.");
			
		else
			param.rotation = 0;
			
		if (param.requires == undefined)
			param.requires = [];

		if (children != undefined)	
			children(param);

		currentPart.type = "rect";
		currentPart.params = param;

		var rp = { angle: param.rotation, cx: param.x, cy: param.y };
		this.outlines.push( { type: "rect", param: param } );
		
		var firstCut = true;
		var lastPoint = false;
		
		if (param.clockwise == undefined)
			param.clockwise = true;
			
		var grooveSpeed = param.grooveSpeed == undefined ? param.speed * 0.4 : param.grooveSpeed;
		
		for (var z = param.z0 - param.stepSizeZ; z >= param.z0 - param.depth; z -= param.stepSizeZ)
		{
			var needDip = true;
			
			// dip into the material		
			if (param.nSteps % 1 == 0.5 && !param.outlineOnly)
			{
				// cut the spine (from right to left)
				var p1 = rotP({ x: param.x + (!portrait ? spine / 2 : 0), 
								y: param.y + ( portrait ? spine / 2 : 0) }, rp);

				if (firstCut)
				{
					this.startPart(p1, param.requires);
					firstCut = false;
				}

				feed(p1);
				if (needDip)
				{
					needDip = false;
					this.dipIn(z, param);
				}
				
				var p = rotP({ 	x: param.x - (!portrait ? spine / 2 : 0), 
								y: param.y - ( portrait ? spine / 2 : 0) }, rp);
				
				straightFeed({ x: p.x, y: p.y, speed: grooveSpeed });
				lastPoint = p;
			}
			
			for (var s = param.outlineOnly ? Math.ceil(param.nSteps) - 1 : 0; s < Math.ceil(param.nSteps); s++)
			{
				// cut rect clockwise starting at the top left corner
				var xdiff = (!portrait ? spine / 2 : 0) + (s + 1 - param.nSteps % 1) * param.stepSize;
				var ydiff = ( portrait ? spine / 2 : 0) + (s + 1 - param.nSteps % 1) * param.stepSize;
			
				var p1 = rotP({ x: param.x - xdiff,
								y: param.y - ydiff }, rp);
				
				var firstSpeed = param.speed;
				if (firstCut)
				{
					this.startPart(p1, param.requires);
					feed(p1);
					firstCut = false;
					firstSpeed = grooveSpeed;
				}
				else
					straightFeed({ x: p1.x, y: p1.y, speed: grooveSpeed });

				var extendCornersDiff = (extendCorners && s == Math.ceil(param.nSteps) - 1) ? (1 - 1 / Math.sqrt(2)) * mill / 2 : 0;

				if (needDip)
				{
					needDip = false;
					this.dipIn(z, param);
				}
				
				// top left (clockwise)
				var p = rotP({ x: param.x + (param.clockwise ? -1 : 1) * xdiff, y: param.y + (param.clockwise ? +1 : -1) * ydiff }, rp);
				var ext = { x: extendCornersDiff, y: extendCornersDiff };
				
				straightFeed(p, { speed: firstSpeed });
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * (param.clockwise ? 6 : 2) / 4 })), { speed: grooveSpeed });
					straightFeed(p, { speed: param.speed });
				}
				
				// top right 
				p = rotP({ x: param.x + xdiff, y: param.y + ydiff }, rp);
				straightFeed(p, { speed: firstSpeed });
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 0 / 4})), { speed: grooveSpeed });
					straightFeed(p, { speed: param.speed });
				}
				
				// bottom right (clockwise)
				p = rotP({ x: param.x + (param.clockwise ? 1 : -1) * xdiff, y: param.y + (param.clockwise ? -1 : 1) * ydiff }, rp);
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * (param.clockwise ? 2 : 6) / 4})), { speed: grooveSpeed });
					straightFeed(p, { speed: param.speed });
				}
				
				// bottom left
				p = rotP({ x: param.x - xdiff, y: param.y - ydiff }, rp);
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 4 / 4})), { speed: grooveSpeed });
					straightFeed(p, { speed: param.speed });
				}
				
				lastPoint = p;
			}
			
			if (param.fineEdge)
			{
				var xdiff = param.width / 2;
				var ydiff = param.height / 2;
				
				// top left
				var p = rotP({ x: param.x + xdiff, y: param.y - ydiff, speed: param.speed }, rp);
				var ext = { x: extendCornersDiff, y: extendCornersDiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 6 / 4 })));
					straightFeed(p);
				}
				
				// top right
				p = rotP({ x: param.x + xdiff, y: param.y + ydiff }, rp);
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 0 / 4 })));
					straightFeed(p);
				}
				
				// bottom right
				p = rotP({ x: param.x - xdiff, y: param.y + ydiff }, rp);
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 2 / 4 })));
					straightFeed(p);
				}
				
				// bottom left
				p = rotP({ x: param.x - xdiff, y: param.y - ydiff }, rp);
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed(addP(p, rotP(ext, { cx: 0, cy: 0, angle: rp.angle + Math.PI * 4 / 4 })));
					straightFeed(p);
				}
				
				lastPoint = p;
			}
		}

		return this.endPart(lastPoint);		
	}
	
	this.drill = function(param, children)
	{
		if (param.radius == undefined)
			param.radius = 0;
			
		else
		{
			if (!param.inline)
				param.radius -= mill / 2;
			
			else
				param.radius += mill / 2;
			
			console.assert(param.radius >= 0, "Hole smaller than tool");
				
			if (param.clockwise == undefined)
				param.clockwise = this.options.drillClockwise;
		}
			
		console.assert(param.x != undefined && param.y != undefined, "No coordinates for object specified");
		
		if (param.radius == 0) 
			param.stepSize = 0;

		basicParamCheck(param, "drill");
		this.outlines.push( { type: "drill", param: param } );

		if (param.requires == undefined)
			param.requires = [];
		
		if (children != undefined)	
			children(param);

		currentPart.type = "drill";
		currentPart.params = param;

		var p = { x: param.x - param.stepSize, y: param.y };
		this.startPart(p, param.requires);
		
		var speedH = param.speed;
		if (speedH == undefined)
			speedH = this.options.maxHSpeed;
			
		var maxVSpeed = param.maxVSpeed == undefined ? this.options.maxVSpeed : param.maxVSpeed;
		var lastPoint = false;
			
		if (param.radius == 0)
		{
			// dip in directly:
			feed(p);
			feed({ z: param.z0 });
			this.dipIn(param.z0 - param.depth, param);
			return this.endPart(p);
		}
		
		for (var s = param.outlineOnly ? param.nSteps - 1 : 0; s < param.nSteps + (param.fineEdge ? 1 : 0); s++)
		{
			// calculate speeds & limits
			var r = s < param.nSteps ? (param.outlineOnly ? param.radius - param.fineEdge : param.stepSize * (1 + s)) : param.radius;
			var circ = 2 * Math.PI * r;
			
			// fine edge
			if (s == param.nSteps && param.fineSpeed != undefined)
				speedH = param.fineSpeed;
			
			// time for one rotation
			var t = circ / speedH;
			var speedZ = param.stepSizeZ / t;
			var speedXY = speedH;
			t = circ / speedH;
			
			// slow down if necessary
			if (speedZ > maxVSpeed)
			{
				t = param.stepSizeZ / maxVSpeed;
				speedXY = param.stepSize / t;
				speedZ = maxVSpeed;
			}
			// caluclate resulting feed needed
			var speedXYZ = Math.sqrt(Math.pow(speedXY, 2) + Math.pow(speedZ, 2)); // unneeded?
			//var speedXYZ = speedXY;
			
			lastPoint = { x: param.x - r, y: param.y };
			feed(lastPoint);
			this.dipIn(param.z0, param);
			command({ type: param.clockwise ? G2 : G3, i: r, j: 0, z: param.z0 - param.depth, speed: speedXYZ, p: param.nStepsZ });
			command({ type: param.clockwise ? G2 : G3, i: r, j: 0, z: param.z0 - param.depth, speed: speedH,   p: 1 });
			feed({ z: param.z0 });
		}

		return this.endPart(lastPoint);
	}
	
	var meas = new THREE.Object3D();
	var measures = function(primary, secondary, invisible) 
	{
		scene.remove(meas);
		delete meas;
		meas = new THREE.Object3D();
		var line = new THREE.Geometry();
		v1 = new THREE.Vector3();
		v1[primary] = that.min[primary];
		v1[secondary] = that.min[secondary]-10;
		v2 = new THREE.Vector3();
		v2[primary] = that.max[primary];
		v2[secondary] = that.min[secondary]-10;
		line.vertices.push(v1);
		line.vertices.push(v2);
		meas.add(new THREE.Line( line, coloredMaterial("violet"), THREE.LinePieces ));
		var textGeom = new THREE.TextGeometry((that.max[primary]-that.min[primary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, coloredMaterial("violet"));
		textGeom.computeBoundingBox();
		wh = (textGeom.boundingBox.max.x-textGeom.boundingBox.min.x)/2;
		text.position[primary] = (that.min[primary]+that.max[primary]-wh);
		text.position[secondary] = that.min[secondary]-20;
		if (secondary == "z")
			text["rotate"+primary.toUpperCase()](Math.PI/2);
		if (primary == "y")
			text["rotateZ"](Math.PI/2);
		meas.add(text);
		var line = new THREE.Geometry();
		v3 = new THREE.Vector3();
		v3[secondary] = that.min[secondary];
		v3[primary] = that.min[primary]-10;
		v4 = new THREE.Vector3();
		v4[secondary] = that.max[secondary];
		v4[primary] = that.min[primary]-10;
		line.vertices.push(v3);
		line.vertices.push(v4);
		meas.add(new THREE.Line( line, coloredMaterial( "violet"), THREE.LinePieces ));
		textGeom = new THREE.TextGeometry((that.max[secondary]-that.min[secondary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, coloredMaterial( "violet"));
		textGeom.computeBoundingBox();
		wh = (textGeom.boundingBox.max.x-textGeom.boundingBox.min.x)/2;
		
		text["rotate"+invisible.toUpperCase()](secondary=="z" && primary == "x" ? -Math.PI/2 : Math.PI/2);
		if (secondary == "z")
		{
			text["rotate"+primary.toUpperCase()](Math.PI/2);
		}
		text.position[secondary] = (that.min[secondary]+that.max[secondary]-wh);
		if (primary == "y")
		{
			text["rotateZ"](Math.PI/2);
		}
			text.position[primary] = that.min[primary]-15;
		meas.add(text);
		scene.add(meas);
		scene.add(meas);
	}
	
	function rnd(limit)
	{
		return Math.floor(Math.random() * limit);
	}
	
	function sortObject(obj) 
	{
		var arr = [];
		for (var prop in obj) 
		{
		    if (!obj.hasOwnProperty(prop)) 
		    	continue;

	        arr.push({ 'key': prop, 'value': obj[prop] });
		}
		arr.sort(function(a, b) { return a.value - b.value; });
		
		var retMap = {};
		for (var i in arr)
			retMap[arr[i].key] = arr[i].value;
		
		return retMap;
	}
	
	this.bestPartOrder = false;
	var distMap = {};
	var nTrialsDone = 0;
	var bestResult = 0;
	var bestResultN = 0;
	var pathSearchStart;
	var doPathFinding = true;
		
	function findBestPath()
	{
		if (!that.options.nPathTrials)
			return;
	
		if (nTrialsDone == 0)
		{
			pathSearchStart = Date.now();
			for (var i = 0; i < parts.length; i++)
			for (var j = 0; j < parts.length; j++)
			{
				if (i == j)
					continue;
				
				var part1 = parts[i];
				var part2 = parts[j];
				
				if (!part1.endPoints[1] || !part2.endPoints[1])
					continue;
				
				// from one's output to the others input
				var dist12 = Math.sqrt(Math.pow(part2.endPoints[0].x - part1.endPoints[1].x, 2) + Math.pow(part2.endPoints[0].y - part1.endPoints[1].y, 2));
				var dist21 = Math.sqrt(Math.pow(part1.endPoints[0].x - part2.endPoints[1].x, 2) + Math.pow(part1.endPoints[0].y - part2.endPoints[1].y, 2));
			
				if (!distMap[i]) distMap[i] = {};
				if (!distMap[j]) distMap[j] = {};
				
				distMap[i][j] = dist12;
				distMap[j][i] = dist21;
			}
		
			// sort maps
			for (var i = 0; i < parts.length; i++)
				sortObject(distMap[i]);

			bestResult = 0;
			bestPartOrder = [ 0 ];
			for (var j = 1; j < parts.length; j++)
			{
				bestPartOrder.push(j);
				bestResult += distMap[j - 1][j];
			}
		
			console.log("Starting order result: " + bestResult);
			if (renderer != null)
				createProgram();
				
			time();
				
			bestPartOrder = false;
			totalJogTime = bestResult / that.options.maxJogSpeed;
			jogmin = Math.floor(totalJogTime);
			jogsec = Math.floor((totalJogTime * 60) % 60);
			updateTimeDisplay();

			if (renderer == null)
			{
				var t = Date.now() - pathSearchStart;
				$("#output").append("<div><span style=\"width: 150px; display: inline-block\">" + t + " </span>" + bestResult + "</div>");
			}

			$("#pathtime #jogtime").html(jogmin + " min, " + jogsec + " sec");
			
			if (!doPathFinding)
				return;
		}

		var i;
		var max = that.options.nPathIters;
		if (max > that.options.nPathTrials)
			max = that.options.nPathTrials;
			
		for (i = 0; i < max; i++)
		{
			// try for the n-th time:
			var sum = 0;
			var partOrder = [];
			var remainder = [];
			
			// pick random starting item
			var lastPart = rnd( parts.length );
			
			if (parts[lastPart].requires && parts[lastPart].requires.length)
				continue;
			
			partOrder.push(lastPart);
			
			for (var j = 0; j < parts.length; j++)
				if (j != lastPart)
					remainder.push(j);
			
			while (remainder.length > 0) 
			{
				// pick random remaining item, prefer close ones
				var j;
				var remainderSorted = [];
				var maxDeviation = 10; // percent
				var minParts = 5;
				var wf = 5;
				
				for (j = 0; j < remainder.length; j++)
				{
					var weight = 1 / Math.pow(distMap[lastPart][remainder[j]], wf);
					remainderSorted.push({ dist: distMap[lastPart][remainder[j]], weight: weight, part: j });
				}
				
				remainderSorted.sort( function (a, b) { return a.dist - b.dist; } );

				var sumX = 0, limit = null;
				for (j = 0; j < remainderSorted.length; j++)
				{
					if (limit == null)
						limit = (1 + maxDeviation / 100) * remainderSorted[j].dist;
						
					else if (remainderSorted[j].dist > limit && j >= minParts)
					{
						remainderSorted.splice(j, remainderSorted.length - j);
						break;
					}

					sumX += remainderSorted[j].weight;
				}
				
				var target = Math.random() * sumX;
				sumX = 0;
				for (j = 0; j < remainderSorted.length; j++)
				{
					sumX += remainderSorted[j].weight;
					if (sumX >= target)
					{
						j = remainderSorted[j].part;
						break;
					}
				}
				
				if (parts[remainder[j]].requires && parts[remainder[j]].requires.length)
				{
					var ok = true;
					for (var k = 0; k < parts[remainder[j]].requires.length; k++)
					{
						ok = false;
						for (var l = 0; l < partOrder.length; l++)
						if (parts[remainder[j]].requires[k] == partOrder[l])
						{
							ok = true;
							break;
						}
						
						if (!ok)
							break;
					}
					
					if (!ok)
						continue;
				}
				
				partOrder.push(remainder[j]);
				sum += distMap[lastPart][remainder[j]];
				
				if (bestPartOrder && sum > bestResult)
					break;
				
				lastPart = remainder[j];				
				remainder.splice(j, 1);
			}
			
			if (!bestPartOrder || sum < bestResult)
			{
				if (nTrialsDone - bestResultN > that.options.nPathTrials / 20) // change less than 1/10th second in jog time
				{
					console.log("stopping search since last result was centuries ago");
					that.options.nPathTrials = 0;
				}
				
				bestResult = sum;
				bestPartOrder = partOrder;
				
				if (renderer != null)
					createProgram();

				time();
				
				if (renderer == null)
				{
					var t = Date.now() - pathSearchStart;
					$("#output").append("<div><span style=\"width: 150px; display: inline-block\">" + t + " </span>" + sum + "</div>");
				}
				
				console.log(i + " - found better result: " + sum, partOrder);
			}
		}
		
		totalJogTime = bestResult / that.options.maxJogSpeed;
		jogmin = Math.floor(totalJogTime);
		jogsec = Math.floor((totalJogTime * 60) % 60);
		updateTimeDisplay();
		$("#pathtime #jogtime").html(jogmin + " min, " + jogsec + " sec");
		nTrialsDone += i;
	}	
	
	this.test = function()
	{
		var r = (19.5 - mill) / 2;
		var d = 45; 
		
		var dz = 14.02;
		var dp = 10.32;
		
		var s = 240;
		
		var dy = -r;
		var dx = -d / 2;
		
		this.startPart({x: dx, y: -r + dy });
		straightFeed({ x: dx, y: -r + dy, speed: 400 });

		for (var z = 0; z > -25; z -= 1.5)
		{		
			this.dipIn(z, { dipSpeed: 100, speed: 100 });
			command({ type: G2, i: 0, j: r, z: z, speed: s, x: dx, y: r + dy });
			command({ type: G1, x: d + dx, y: r + dy, z: z });
			command({ type: G2, i: 0, j: -r, z: z, x: d + dx, y: -r + dy });
			command({ type: G1, x: dx, y: -r + dy, z: z });
		}
		return this.endPart({x: dx, y: -r + dy });
	}
	
	function executePart(part)
	{
		part.commands.forEach(function(command) 
		{
			switch (command.type) 
			{
				case G0:
				case G1:
					var line = new THREE.Geometry();
					var p1 = new THREE.Vector3( _x, _y, _z );
					line.vertices.push(p1);
					if (_x == false)
					{
						update(command);
						break;
					}
					else
						update(command);
					var p2 = new THREE.Vector3( _x, _y, _z );
					line.vertices.push(p2);
					line.computeLineDistances();
					if (command.type == G0)
					{
						scene.add(new THREE.Line( line, currentStyle.G0 ));
						
						var geo = new THREE.CylinderGeometry( 0, 0.05, 0.25, 5, 1 );
						var ah = new THREE.Mesh(geo, coloredMaterial( currentStyle.arrowColor ));
						
						var len = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
						var sf = len / 4;
						
						if (sf < 1.5) sf = 1.5;
						
						ah.scale.set(sf, sf, sf);
						ah.rotation.x += Math.PI / 2;
						var w = new THREE.Object3D();
						w.add(ah);
						w.position.set(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) / 2, p1.z + (p2.z - p1.z) / 2);
						w.lookAt(p2);
						scene.add(w);
					}
					else
						scene.add(new THREE.Line( line, currentStyle.G1 ));
					break;
				case G2:
				case G3:
					var line = new THREE.Geometry();
					var r = Math.sqrt(Math.pow(command.i, 2) + Math.pow(command.j, 2));
					var p;
					startz = _z;
					cx = _x + command.i;
					cy = _y + command.j;
					
					if (command.p == undefined) // p mode
					{
						var x = command.x;
						var y = command.y;
						
						console.log(command, _x, _y);
						var a0, a1, dir = 0;
						if (command.j != 0 && command.y - _y != 0)
						{
							a0 = Math.atan(command.i / command.j);
							a1 = Math.atan((command.x - _x) / (command.y - _y));
							
							if (a0 == 0 && a1 == 0)
							{
								a0 = (command.j > 0 ? 3 : 1) * Math.PI / 2;
								a1 = (command.j > 0 ? 1 : 3) * Math.PI / 2;
							}
						}
						
						else
						{
							dir = 1;
							a0 = command.i > 0 ? 0 : Math.PI;
							a1 = command.i > 0 ? Math.PI : 0;
						}
						
						var da = a1 - a0;
						
						if (da < 0)
						{
							a1 += Math.PI * 2;
							da += Math.PI * 2;
						}
						
						console.log(a0, a1);

						for (var a = a0; a < a1; a += (command.type == G2 ? 1 : -1) * da / 100)
						{
							p = {
									x: cx - Math.cos(a) * r, 
									y: cy + Math.sin(a) * r, 
									z: startz + (command.z - startz) * a / da
								};
								
							line.vertices.push(new THREE.Vector3(p.x, p.y, p.z));
						}
					}
					
					else // p defined
					for (var n = 0; n <= 1.0001; n+=0.005)
					{
						p = {
								x: cx - Math.cos(-n * command.p * 2 * Math.PI) * r, 
								y: cy + Math.sin(-n * command.p * 2 * Math.PI) * r, 
								z: startz + (command.z - startz) * n 
							};

						line.vertices.push(new THREE.Vector3(p.x, p.y, p.z));
					}
					
					update(p);
					scene.add(new THREE.Line( line, currentStyle.G1 ));
				default:
					break;
			}
		});
	}
	
	function drawArcS(shape, cx, cy, r, astart, alen)
	{		
		shape.absarc( cx, cy, r, astart, alen, true );
	}
	
	function drawArc(cx, cy, z, r, astart, alen, closed)
	{
		var arcShape = new THREE.Shape();
	
		var a = Math.cos(astart) * r;
		var b = Math.sin(astart) * r;
		arcShape.moveTo( cx + a, cy + b );
		
		drawArcS(arcShape, cx, cy, r, astart, alen );
		
		var points = arcShape.createPointsGeometry(500);
		if (!closed)
			points.vertices.pop();
			
		var line = new THREE.Line( points, currentStyle.outline );
		line.position.set( 0, 0, z );
		scene.add( line );
	}
	
	var first = true;
	function createProgram() 
	{
/*		if (first)
			first = false;
		else
			return;*/
		_x = false;
		_y = false;
		_z = false;
		_f = false;
	
		this.min = {x:10000, y: 10000, z: 10000};
		this.max = {x:-10000, y: -10000, z: -10000};
	
		if (scene)
		{
			while (scene.children.length > 0)
			{
				c = scene.children.pop()
				scene.remove(c);
				if (c.geometry)
				{
					c.geometry.dispose();
					delete c.geometry;
				}
				delete c;
			}
		}
		delete scene;
		scene = new THREE.Scene();
		
		that.outlines.forEach( function (obj) 
		{
			if (obj.type == "rect")
			{
				var line;
				
				for (var zoff = 0; zoff < obj.param.depth + obj.param.stepSizeZ / 2; zoff += obj.param.stepSizeZ * 2)
				{
					var c = obj.param.extendCorners ? (1 - 2 / Math.sqrt(2)) : 1;
					var c2 = 1 - 1 / Math.sqrt(2);
					var z = obj.param.z0 - zoff;
				
					var arcShape = new THREE.Shape();
					
					var w = obj.param.width - (obj.param.inline ? 2 * mill : 0);
					var h = obj.param.height - (obj.param.inline ? 2 * mill : 0);

					arcShape.moveTo( obj.param.x + (w + c * mill) / 2, obj.param.y - (h + 1 * mill) / 2 ); // ur

					arcShape.moveTo( obj.param.x - (w + c * mill) / 2, obj.param.y - (h + 1 * mill) / 2 ); // ul
					if (obj.param.extendCorners)
						drawArcS(arcShape, obj.param.x - (w + c2 * mill) / 2, obj.param.y - (h + c2 * mill) / 2, mill / 2,  7 / 4 * Math.PI,   3 / 4 * Math.PI); // ul
					
					arcShape.moveTo( obj.param.x - (w + 1 * mill) / 2, obj.param.y + (h + c * mill) / 2 ); // ol
					if (obj.param.extendCorners)
						drawArcS(arcShape, obj.param.x - (w + c2 * mill) / 2, obj.param.y + (h + c2 * mill) / 2, mill / 2,  5 / 4 * Math.PI,   1 / 4 * Math.PI); // ol

					arcShape.moveTo( obj.param.x + (w + c * mill) / 2, obj.param.y + (h + 1 * mill) / 2 ); // or
					if (obj.param.extendCorners)
						drawArcS(arcShape, obj.param.x + (w + c2 * mill) / 2, obj.param.y + (h + c2 * mill) / 2, mill / 2, 11 / 4 * Math.PI,   7 / 4 * Math.PI); // or
						
					if (obj.param.extendCorners)
					{
						arcShape.moveTo( obj.param.x + (w + 1 * mill) / 2, obj.param.y - (h + c * mill) / 2 ); // ur
						drawArcS(arcShape, obj.param.x + (w + c2 * mill) / 2, obj.param.y - (h + c2 * mill) / 2, mill / 2,  9 / 4 * Math.PI,   5 / 4 * Math.PI); // ur
					}
					
					line = new THREE.Line( arcShape.createPointsGeometry(), currentStyle.outline );
					line.position.set( 0, 0, z );
					line.rotation.set( 0, 0, obj.param.rotation );
					scene.add( line );

					if (obj.param.extendCorners)
					{
						line = new THREE.Geometry();
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + c * mill) / 2, obj.param.y - (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + 1 * mill) / 2, obj.param.y - (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + 1 * mill) / 2, obj.param.y - (h + c * mill) / 2, z ));
						line = new THREE.Line( line, currentStyle.outline2)
						line.rotation.set( 0, 0, obj.param.rotation );
						scene.add(line);

						line = new THREE.Geometry();
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + c * mill) / 2, obj.param.y - (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + 1 * mill) / 2, obj.param.y - (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + 1 * mill) / 2, obj.param.y - (h + c * mill) / 2, z ));
						line = new THREE.Line( line, currentStyle.outline2)
						line.rotation.set( 0, 0, obj.param.rotation );
						scene.add(line);

						line = new THREE.Geometry();
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + c * mill) / 2, obj.param.y + (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + 1 * mill) / 2, obj.param.y + (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x + (w + 1 * mill) / 2, obj.param.y + (h + c * mill) / 2, z ));
						line = new THREE.Line( line, currentStyle.outline2)
						line.rotation.set( 0, 0, obj.param.rotation );
						scene.add(line);

						line = new THREE.Geometry();
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + c * mill) / 2, obj.param.y + (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + 1 * mill) / 2, obj.param.y + (h + 1 * mill) / 2, z ));
						line.vertices.push(new THREE.Vector3(obj.param.x - (w + 1 * mill) / 2, obj.param.y + (h + c * mill) / 2, z ));
						line = new THREE.Line( line, currentStyle.outline2)
						line.rotation.set( 0, 0, obj.param.rotation );
						scene.add(line);
					}
				}
				return;
			}
			
			if (obj.type == "drill")
			{
				if (obj.param.radius == 0)
				{
					drawArc(obj.param.x, obj.param.y, obj.param.z0, mill / 2, 0, 2 * Math.PI, true);
				}
			
				else
				for (var zoff = 0; zoff < obj.param.depth + obj.param.stepSizeZ / 2; zoff += obj.param.stepSizeZ * 2)
				{
					var z = obj.param.z0 - zoff;
					drawArc(obj.param.x, obj.param.y, z, obj.param.radius + (obj.param.inline ? -1 : 1) * mill / 2, 0, 2 * Math.PI, true);
				}
				return;
			}			
		});
	
		if (bestPartOrder)
		for (var i = 0; i < bestPartOrder.length; i++)
		{
			var partID = bestPartOrder[i];
			executePart(parts[partID]);
		}
		
		else
			parts.forEach(executePart);
		
		arrow(X, 0xFF00FF);
		arrow(Y, 0x00FFFF);
		arrow(Z, 0xFFFF00);
		
		if (that.body != null && that.body.draw)
		{
			cube = new THREE.Mesh(new THREE.CubeGeometry(that.body.width, that.body.height, that.body.depth), currentStyle.partMaterial);
			cube.position.set(that.body.x, that.body.y, that.body.z - that.body.depth / 2);
			scene.add(cube);
		}
	}
	
	this.setBody = function( param )
	{
		console.assert(param != null);
		
		this.body = {};
		this.body.x = param.x == null ? 0 : param.x;
		this.body.y = param.y == null ? 0 : param.y;
		this.body.z = param.z == null ? 0 : param.z;
		
		this.body.width  = param.width  == null ? 0 : param.width;
		this.body.height = param.height == null ? 0 : param.height;
		this.body.depth  = param.depth  == null ? 0 : param.depth;
		
		if (param.width != null && param.height != null && param.depth != null)
			this.body.draw = true;
	}
	
	var objects = [];

	var WIDTH = window.innerWidth,
		HEIGHT = window.innerHeight;

	var busy = false;
	function render() 
	{
		busy = true;
		renderer.render( scene, camera );
		busy = false;
	}
	
	function sanitize(_var) 
	{
		return typeof(_var)=="number" ? _var.toFixed(3) : _var;
	}
	
	function hex(x, y, s) 
	{
		feed({z: -4});
		for (r = 0.0; r<s/2-mill/2; r+= 5.0)
			for (a = Math.PI/6.0; a <= Math.PI*13/6.0; a+=Math.PI/3.0)
				straightFeed({x: x+r*Math.cos(a), y: y+r*Math.sin(a)});

		feed({z: -1});
		r=s/2;
		for (a = Math.PI/6.0; a <= Math.PI*13/6.0; a+=Math.PI/3.0)
			straightFeed({x: x+r*Math.cos(a), y: y+r*Math.sin(a)});
	}
	
	function onWindowResize()
	{
		WIDTH = window.innerWidth;
		HEIGHT = window.innerHeight;
		camera.aspect = WIDTH / HEIGHT;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );
	}
	
	function init() 
	{
		scene = new THREE.Scene();
		var div, button;

		try
		{
			renderer = new THREE.WebGLRenderer( { antialias: true } );
			renderer.setClearColor( 0x111111, 1 );
			renderer.setSize( WIDTH, HEIGHT );
		
			var container = document.getElementById( 'container' );
			container.appendChild( renderer.domElement );

			div = $("<div>").appendTo("body").addClass("buttons");
			button = $("<button>").appendTo(div).html("copy gcode").click(that.toText);
			button = $("<button>").appendTo(div).html("perspective view").click(setView.bind(null, PERSPECTIVE));
			button = $("<button>").appendTo(div).html("top view").click(setView.bind(null, TOP));
			button = $("<button>").appendTo(div).html("side view").click(setView.bind(null, SIDE));
			button = $("<button>").appendTo(div).html("front view").click(setView.bind(null, FRONT));
			button = $("<button>").appendTo(div).html("edit source").click(function() {
			});
			//
		
			window.addEventListener( 'resize', onWindowResize, false );
		}
		catch (e)
		{
			renderer = null;
			
			div = $("<div class=\"error\">Unfortunately, a WebGL renderer could not be created. Please close this window and try again.</div>").appendTo("body");
		}

		button = $("<div>").appendTo(div).html("").attr("id", "time");
		button = $("<div>").appendTo(div).html("<span id=\"label\">calculating best path... jog time</span>: <span id=\"jogtime\"></span><span id=\"stopbuttonw\"> - </span>").attr("id", "pathtime");
		button = $("#stopbuttonw").append($("<a>").html("stop").attr("href", "#").attr("id", "stopbutton"));
		$("#stopbutton").click(function()
		{
			that.options.nPathTrials = 1;
		});
		button = $("<div>").appendTo(div).html("").attr("id", "output");
	}
		
	var activeRenderer = false;
	var lastRender = false;
	var fps = 30;
	
	function animate() 
	{
		render();
	
		var d = new Date();
		var waitTime = 0;
		
		if (lastRender)
			waitTime = 1000 / fps - (d.getMilliseconds() - lastRender.getMilliseconds() + 1000) % 1000;
		
		lastRender = d;
	
		setTimeout( function()
		{
			requestAnimationFrame( animate );
		}, waitTime);
	}
	
	var PERSPECTIVE = 0, TOP = 1, SIDE = 2, FRONT = 3;
	function setView(r) 
	{
		console.log("setting renderer to ", r);
		switch(r) 
		{
			case PERSPECTIVE:
				measures("x", "y", "z");
				var ar = WIDTH / HEIGHT;
				var vfov = 60;
				camera = new THREE.PerspectiveCamera( vfov, ar, 1, 25000 );
				camera.up.set(0,0,1);
				controls = new THREE.OrbitControls( camera );
				controls.target.x = (that.max.x+that.min.x) / 2;
				controls.target.y = (that.max.y+that.min.y) / 2;
				controls.target.z = (that.max.z+that.min.z) / 2;

				camera.position.x = (that.max.x + that.min.x) / 2;
				camera.position.y = (that.max.y + that.min.y) / 2 - 5;
				
				var alpha = (vfov / 2 - 1) / 180 * Math.PI;
				var beta = Math.atan( ar * alpha ); // hfov / 2
				
				var zx = (that.max.x - that.min.x) / 4 / Math.tan(alpha);
				var zy = (that.max.y - that.min.y) / 4 / Math.tan(beta);
				
				camera.position.z = Math.max(zx, zy);
				
				camera.lookAt(new THREE.Vector3((that.max.x+that.min.x) / 2, (that.max.y+that.min.y) / 2, (that.max.z+that.min.z) / 2));
				controls.update();
				render();
				break;
			case SIDE:
				measures("y", "z", "x");
				w1 = 1.1*(that.max.y-that.min.y)/2;
				w2 = 1.1*(that.max.z-that.min.z)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( w, -w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.y = (that.max.y+that.min.y) / 2;
				camera.position.x = that.min.x;
				camera.position.z = (that.max.z+that.min.z) / 2;
				camera.up.set(0,0,1);
				camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI/2);
				camera.lookAt(new THREE.Vector3((that.max.x+that.min.x) / 2, (that.max.y+that.min.y) / 2, (that.max.z+that.min.z) / 2));
				controls = new THREE.OrbitControls( camera, undefined, true  );
				controls.center.x = (that.max.x+that.min.x) / 2;
				controls.center.z = (that.max.z+that.min.z) / 2;
				controls.center.y = (that.max.y+that.min.y) / 2;
				render();
				break;			
			case TOP:
				measures("x", "y", "z");
				w1 = 1.1*(that.max.x-that.min.x)/2;
				w2 = 1.1*(that.max.y-that.min.y)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( -w, w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.x = (that.max.x+that.min.x) / 2;
				camera.position.y = (that.max.y+that.min.y) / 2;
				camera.position.z = that.min.z;
				camera.up.set(0,0,1);
				controls = new THREE.OrbitControls( camera, undefined, true );
				//controls.addEventListener( 'change', render );
				controls.center.x = (that.max.x+that.min.x) / 2;
				controls.center.y = (that.max.y+that.min.y) / 2;
				controls.center.z = (that.max.z+that.min.z) / 2;
				render();
				break;			
			case FRONT:
				w1 = 1.1*(that.max.x-that.min.x)/2;
				w2 = 1.1*(that.max.z-that.min.z)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( w, -w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.z = (that.max.z+that.min.z) / 2;
				camera.position.x = (that.max.x+that.min.x) / 2;
				camera.up.set(0,0,1);
				camera.lookAt(new THREE.Vector3((that.max.x+that.min.x) / 2, (that.max.y+that.min.y) / 2, (that.max.z+that.min.z) / 2));
				//camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI/2);
				controls = new THREE.OrbitControls( camera, undefined, true );
				//controls.addEventListener( 'change', render );
				controls.center.x = (that.max.x+that.min.x) / 2;
				controls.center.y = (that.max.y+that.min.y) / 2;
				controls.center.z = (that.max.z+that.min.z) / 2;
				measures("x", "z", "y");
				render();
				break;
		}
	}
	
	this.done = function(pathfind)
	{
		eval($("textarea").text());
		init();
		this.endPart(false);
		
		if (renderer != null)
		{
			time();
			setView(PERSPECTIVE);
			animate();
		}
		
		if (pathfind === false)
		{
			doPathFinding = false;
			findBestPath();
			$("#stopbuttonw").hide();
			$("#label").html("jog time between cuts");
		}
		
		else
			window.setTimeout(timeout, 1);
	}
	
	var lastTime = 1000000;
	function timeout()
	{
		findBestPath();
		//console.log("tick", bestResult);
		
		if (nTrialsDone > that.options.nPathTrials)
		{
			//console.log("stopping path trials");
			$("#stopbuttonw").hide();
			$("#label").html("jog time between cuts");
		}
		
		else
			window.setTimeout(timeout, 1);
	}
}
