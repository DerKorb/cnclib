var renderer, _scene, scene, camera, stats, controls, codeEditor;

function cnclib(userOptions)
{
	var program = [];
	
	this.options = { z_safe: 2, nPathTrials: 1000000, drillClockwise: true, maxVSpeed: 100, maxHSpeed: 400, stepFactor: 0.75, stepFactorZ: 0.25, dipSpeed: 100, maxJogSpeed: 900 };
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
	
	function straightFeed(obj) 
	{
		obj.type = G1;
		command(obj);
	}
	
	function feed(obj) 
	{
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
	
	this.startPart = function(pointIn)
	{
		if (currentPart.commands.length < 2) // feed first
		{
			currentPart.endPoints[0] = pointIn;
			return;
		}
		
		parts.push(currentPart);
		
		currentPart = new ProtoPart(pointIn);
		feed({ z: this.options.z_safe });
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
		w.document.write("<pre>%\n");
		parts.forEach(function(part) 
		{
			part.commands.forEach(function(command)
			{
				c = command;
				var line = "G"+command.type;
				delete c.type;
				for (key in c)
					if (c[key] != undefined)
						line += " "+key.toUpperCase()+sanitize(c[key]);
				w.document.write(line+"\n");
			});
			
			w.document.write("\n");
		});
		w.document.write("%\n<pre>");
	}
	
	var heeksStyle = 
	{
		G1: { color: 0x00FF00, dashSize: 1, gapSize: 0.5}, 
		G0: {color: 0xFF0000, dashSize: 1, gapSize: 0},
		arrowColor: 0xff6666,
		outline: {color: 0x0000ff, dashSize: 1, gapSize: 0}, 
		outline2: {color: 0x8888ff, dashSize: 1, gapSize: 0}, 
	};
	
	var linuxCncStyle = 
	{
		G1: {color: 0xFFFFFF, dashSize: 1, gapSize: 0}, 
		G0: {color: "lightblue", dashSize: 1, gapSize: 0.5},
		arrowColor: "blue",
		outline: {color: 0x0000ff, dashSize: 1, gapSize: 0}, 
		outline2: {color: 0x8888ff, dashSize: 1, gapSize: 0}, 
};
	
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
	
	function time()
	{
		_x = false;
		_y = false;
		_z = false;
		_f = false;
		t = 0;
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
						console.assert(_f != 0, "speed is zero", command, part);
						//console.log(dist,command.type, _f, dist / (command.type == G0 ? that.options.maxJogSpeed : _f));
						t += dist / (command.type == G0 ? that.options.maxJogSpeed : _f);
						break;
					case G2:
					case G3:
						update(command);					

						var r = Math.sqrt(	(command.i == undefined ? 0 : Math.pow(command.i, 2)) +
											(command.j == undefined ? 0 : Math.pow(command.j, 2)) +  
											(command.k == undefined ? 0 : Math.pow(command.k, 2)));
						
						var p = command.p == undefined ? 1 : command.p;
						//console.log(r, p, _f, Math.PI * 2 * r * p / _f);
						t += Math.PI * 2 * r * p / _f;
						break;
						
					default:
						break;
				}
			});
		});
		
		$("#time").html("<font color=\"darkgreen\">Estimated run time <font color=\"orange\">"+Math.floor(t)+" minutes "+Math.floor(((t-Math.floor(t))*60))+" seconds</font></font>");
	}

	var X = 1, Y = 2, Z = 3;
	function arrow(axis, color)
	{
		Arrow = new THREE.Object3D();
		var tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 2, 10, 10, false), new THREE.MeshBasicMaterial({color: color}));
		tip.position.y = 5;
		tip.overdraw = true;
		Arrow.add(tip);
		var base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 10, 10, false), new THREE.MeshBasicMaterial({color: color}));
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
		console.assert(type == "drill" || type == "rect", "Invalid call to basicParamCheck", type);
		
		var span = param[type == "drill" ? "radius" : "span"];
		console.assert(param.depth != undefined, "No depth for hole specified", param);

		if (param.fineEdge == undefined)
			param.fineEdge = that.options.fineEdge;
		
		if (param.fineEdge == undefined || param.width < mill + param.fineEdge * 2 || param.height < mill + param.fineEdge * 2)
			param.fineEdge = 0;
			
		if (param.fineSpeed == undefined)
			param.fineSpeed = that.options.fineSpeed;
			
		if (param.speed == undefined)
			param.speed = that.options.defaultSpeed;
			
		// xy Steps
		if (param.outlineOnly)
			param.stepSize = span / 2 - param.fineEdge; // outline only: only cut outermost trace -> nSteps = 1
		
		if (!param.stepSize && !param.nSteps && !param.stepFactor)
			param.stepFactor = that.options.stepFactor;
			
		if (!param.stepSize && !param.nSteps && param.stepFactor)
		{
			console.assert(param.stepFactor > 0 && param.stepFactor <= 1, "stepFactor needs to lie inbetween 0 and 1 (including)", param);
			param.stepSize = mill * param.stepFactor;
		}
		
		if (param.nSteps != undefined)
			console.assert(span / param.nSteps <= mill, "Not enough steps in hole", param);
		
		if (param.nSteps == undefined)
			param.nSteps = Math.ceil((span - 2 * param.fineEdge) / param.stepSize) * (type == "drill" ? 1 : 0.5);

		console.assert(param.nSteps != 0, "Invalid number of steps", param);
			
		param.stepSize = (span - 2 * param.fineEdge) / Math.floor(2 * param.nSteps);
		console.assert(param.outlineOnly || param.stepSize < mill, "Steps too big for tool", param);
		
		// z Parameters
		console.assert(param.depth > 0, "objects need to have a positive depth", param);
		
		if (param.z0 == undefined)
			param.z0 = 0;
			
		console.assert(param.z0 <= 0, "objects need to be below the surface of your material", param);

		// z Steps
		if (!param.stepSizeZ && !param.nStepsZ && !param.stepFactorZ)
			param.stepFactorZ = that.options.stepFactorZ;
			
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
	
	this.rect = function(param) 
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
		
		param.width -= mill;
		param.height -= mill;
			
		var extendCorners = (this.options.extendCorners && param.extendCorners == undefined) || param.extendCorners;
		param.extendCorners = extendCorners;
		
		var portrait = param.width < param.height;
		var spine = Math.abs(param.width - param.height);
		var span = !portrait ? param.height : param.width;
		
		param.span = span;
		basicParamCheck(param, "rect");

		this.outlines.push( { type: "rect", param: param } );
		
		var firstCut = true;
		var lastPoint = false;
		
		for (var z = param.z0 - param.stepSizeZ; z >= param.z0 - param.depth; z -= param.stepSizeZ)
		{
			var needDip = true;
			
			// dip into the material		
			if (param.nSteps % 1 == 0.5 && !param.outlineOnly)
			{
				// cut the spine (from right to left)
				var p1 = { 	x: param.x + (!portrait ? spine / 2 : 0), 
							y: param.y + ( portrait ? spine / 2 : 0) };

				if (firstCut)
				{
					this.startPart(p1);
					firstCut = false;
				}

				feed(p1);
				if (needDip)
				{
					needDip = false;
					this.dipIn(z, param);
				}
				
				var p = { 	x: param.x - (!portrait ? spine / 2 : 0), 
							y: param.y - ( portrait ? spine / 2 : 0) };
				
				straightFeed({ x: p.x, y: p.y, speed: param.speed });
				lastPoint = p;
			}
			
			for (var s = param.outlineOnly ? Math.ceil(param.nSteps) - 1 : 0; s < Math.ceil(param.nSteps); s++)
			{
				// cut rect clockwise starting at the top left corner
				var xdiff = (!portrait ? spine / 2 : 0) + (s + 1 - param.nSteps % 1) * param.stepSize;
				var ydiff = ( portrait ? spine / 2 : 0) + (s + 1 - param.nSteps % 1) * param.stepSize;
			
				var p1 = { 	x: param.x - xdiff,
							y: param.y - ydiff };
				
				if (firstCut)
				{
					this.startPart(p1);
					feed(p1);
					firstCut = false;
				}
				else
					straightFeed({ x: p1.x, y: p1.y, speed: param.speed });
					
				var extendCornersDiff = (extendCorners && s == Math.ceil(param.nSteps) - 1) ? (1 - 1 / Math.sqrt(2)) * mill / 2 : 0;
					
				if (needDip)
				{
					needDip = false;
					this.dipIn(z, param);
				}
				
				// top left
				var p = { x: param.x + xdiff, y: param.y - ydiff, speed: param.speed };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x + extendCornersDiff, y: p.y - extendCornersDiff });
					straightFeed(p);
				}
				
				// top right
				p = { x: param.x + xdiff, y: param.y + ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x + extendCornersDiff, y: p.y + extendCornersDiff });
					straightFeed(p);
				}
				
				// bottom right
				p = { x: param.x - xdiff, y: param.y + ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x - extendCornersDiff, y: p.y + extendCornersDiff });
					straightFeed(p);
				}
				
				// bottom left
				p = { x: param.x - xdiff, y: param.y - ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x - extendCornersDiff, y: p.y - extendCornersDiff });
					straightFeed(p);
				}
				
				lastPoint = p;
			}
			
			if (param.fineEdge)
			{
				var xdiff = param.width / 2;
				var ydiff = param.height / 2;
				
				// top left
				var p = { x: param.x + xdiff, y: param.y - ydiff, speed: param.fineSpeed };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x + extendCornersDiff, y: p.y - extendCornersDiff });
					straightFeed(p);
				}
				
				// top right
				p = { x: param.x + xdiff, y: param.y + ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x + extendCornersDiff, y: p.y + extendCornersDiff });
					straightFeed(p);
				}
				
				// bottom right
				p = { x: param.x - xdiff, y: param.y + ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x - extendCornersDiff, y: p.y + extendCornersDiff });
					straightFeed(p);
				}
				
				// bottom left
				p = { x: param.x - xdiff, y: param.y - ydiff };
				straightFeed(p);
				
				if (extendCornersDiff)
				{
					straightFeed({ x: p.x - extendCornersDiff, y: p.y - extendCornersDiff });
					straightFeed(p);
				}
				
				lastPoint = p;
			}
		}

		return this.endPart(lastPoint);
	}
	
	this.drill = function(param)
	{
		param.radius -= mill / 2;
		console.assert(param.radius > 0, "Hole smaller than tool");
		
		if (param.clockwise == undefined)
			param.clockwise = this.options.drillClockwise;
			
		console.assert(param.x != undefined && param.y != undefined, "No coordinates for object specified");

		basicParamCheck(param, "drill");
		this.outlines.push( { type: "drill", param: param } );

		var p = { x: param.x - param.stepSize, y: param.y };
		this.startPart(p);
		
		var speedH = param.speed;
		if (speedH == undefined)
			speedH = this.options.maxHSpeed;
			
		var maxVSpeed = param.maxVSpeed == undefined ? this.options.maxVSpeed : param.maxVSpeed;
		var lastPoint = false;
		
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
			
			// slow down if necessary
			if (speedZ > maxVSpeed)
			{
				t = param.stepSizeZ / maxVSpeed;
				speedH = param.stepSize / t;
			}
			
			// caluclate resulting feed needed
			var speedXYZ = Math.sqrt(Math.pow(speedH, 2) + Math.pow(speedZ, 2)); // unneeded?
			//var speedXYZ = speedH;
			
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
		meas.add(new THREE.Line( line, new THREE.LineDashedMaterial( {color: "violet"}), THREE.LinePieces ));
		var textGeom = new THREE.TextGeometry((that.max[primary]-that.min[primary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, new THREE.MeshBasicMaterial({color: "violet"}));
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
		meas.add(new THREE.Line( line, new THREE.LineDashedMaterial( {color: "violet"}), THREE.LinePieces ));
		textGeom = new THREE.TextGeometry((that.max[secondary]-that.min[secondary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, new THREE.MeshBasicMaterial({color: "violet"}));
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
		
	function findBestPath()
	{
		if (!that.options.nPathTrials)
			return;
	
		if (nTrialsDone == 0)
		{
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
		
			bestPartOrder = false;
			console.log("Starting order result: " + bestResult);
		}

		var i;
		for (i = 0; i < 1000; i++)
		{
			// try for the n-th time:
			var sum = 0;
			var partOrder = [];
			var remainder = [];
			
			// pick random starting item
			var lastPart = rnd( parts.length );
			partOrder.push(lastPart);
			
			for (var j = 0; j < parts.length; j++)
				if (j != lastPart)
					remainder.push(j);
			
			while (remainder.length > 0) 
			{
				// pick random remaining item, prefer close ones
				var maxl = remainder.length < 4 ? remainder.length : 4;
				var maxj = maxl * maxl / 2;
				var target = rnd( maxj );

				var j = 0, sumX = 0;
				for (; j < maxl; j++)
				{
					sumX += maxl - j;
					if (sumX >= target)
						break;
				}
				
				var distRem = [];
				for (var k = 0; k < remainder.length; k++)
					distRem.push( { key: k, dist: distMap[lastPart][remainder[k]] });
					
				distRem.sort( function (a, b) { return a.dist - b.dist; } );
				j = distRem[j].key;				

				partOrder.push(remainder[j]);
				sum += distMap[lastPart][remainder[j]];
				
				lastPart = remainder[j];				
				remainder.splice(j, 1);
			}
			
			if (!bestPartOrder || sum < bestResult)
			{
				if (nTrialsDone - bestResultN > that.options.nPathTrials / 100) // change less than 1/10th second in jog time
				{
					console.log("stopping search since last result was centuries ago");
					that.options.nPathTrials = 0;
				}
				
				bestResult = sum;
				bestPartOrder = partOrder;
				createProgram();
				time();
				setView(PERSPECTIVE);
				animate();
				render();
				
				console.log(i + " - found better result: " + sum, partOrder);
			}
		}
		
		jogmin = Math.floor(bestResult / that.options.maxJogSpeed);
		jogsec = Math.ceil((bestResult / that.options.maxJogSpeed * 60) % 60);
		$("#pathtime #jogtime").html(jogmin + " min, " + jogsec + " sec");
		nTrialsDone += i;
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
						scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G0 )));
						
						var geo = new THREE.CylinderGeometry( 0, 0.05, 0.25, 5, 1 );
						var ah = new THREE.Mesh(geo, new THREE.MeshBasicMaterial( {color: currentStyle.arrowColor } ));
						
						var len = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
						var sf = len / 4;
						
						if (sf < 3) sf = 3;
						
						ah.scale.set(sf, sf, sf);
						ah.rotation.x += Math.PI / 2;
						var w = new THREE.Object3D();
						w.add(ah);
						w.position.set(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) / 2, p1.z + (p2.z - p1.z) / 2);
						w.lookAt(p2);
						scene.add(w);
					}
					else
						scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 )));
					break;
				case G2:
				case G3:
					var line = new THREE.Geometry();
					startz = _z;
					cx = _x+command.i;
					cy = _y;
					for (n = 0; n <= 1.0001; n+=0.002)
					{
						line.vertices.push(new THREE.Vector3( cx-Math.cos(-n*command.p*2*Math.PI)*command.i, cy+Math.sin(-n*command.p*2*Math.PI)*command.i, startz+(command.z-startz)*n ));
						update({x: cx-Math.cos(-n*command.p*2*Math.PI)*command.i, z: startz+(command.z-startz)*n, y: cy+Math.sin(-n*command.p*2*Math.PI)*command.i });
					}
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 )));
				default:
					break;
			}
		});
	}
	
	function drawArc(cx, cy, z, r, astart, alen, closed)
	{
		var arcShape = new THREE.Shape();
		
		var a = Math.cos(astart) * r;
		var b = Math.sin(astart) * r;
		
		arcShape.moveTo( cx + a, cy + b );
		arcShape.absarc( cx, cy, r, astart, alen, true );

		var points = arcShape.createPointsGeometry();
		if (!closed)
			points.vertices.pop();
			
		var line = new THREE.Line( points, new THREE.LineBasicMaterial( currentStyle.outline ) );
		line.position.set( 0, 0, z );
		scene.add( line );
	}
	
	function createProgram() 
	{
		_x = false;
		_y = false;
		_z = false;
		_f = false;
	
		this.min = {x:10000, y: 10000, z: 10000};
		this.max = {x:-10000, y: -10000, z: -10000};
	
		_scene.remove(scene);
		delete scene;
		
		scene = new THREE.Object3D();
		_scene.add(scene);
		
		that.outlines.forEach( function (obj) 
		{
			if (obj.type == "rect")
			{
				var line;
				
				var c = obj.param.extendCorners ? (1 - 2 / Math.sqrt(2)) : 1;
				
				line = new THREE.Geometry();
				line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
				line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
				scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline )));
				line = new THREE.Geometry();
				line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0 ));
				line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0 ));
				scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline )));
				line = new THREE.Geometry();
				line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
				line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
				scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline )));
				line = new THREE.Geometry();
				line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0 ));
				line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0 ));
				scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline )));

				if (obj.param.extendCorners)
				{
					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));

					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));


					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
				
					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
				

					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
				
					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x + (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
				
				
					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
				
					line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + 1 * mill) / 2, obj.param.z0 ));
					line.vertices.push(new THREE.Vector3(obj.param.x - (obj.param.width + 1 * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0 ));
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.outline2 )));
					

					c = 1 - 1 / Math.sqrt(2);
					drawArc(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0, mill / 2,  5 / 4 * Math.PI,   1 / 4 * Math.PI);
					drawArc(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y + (obj.param.height + c * mill) / 2, obj.param.z0, mill / 2, 11 / 4 * Math.PI,   7 / 4 * Math.PI);
					drawArc(obj.param.x + (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0, mill / 2,  9 / 4 * Math.PI,   5 / 4 * Math.PI);
					drawArc(obj.param.x - (obj.param.width + c * mill) / 2, obj.param.y - (obj.param.height + c * mill) / 2, obj.param.z0, mill / 2,  7 / 4 * Math.PI,   3 / 4 * Math.PI);
				}
				
				return;
			}
			
			if (obj.type == "drill")
			{
				drawArc(obj.param.x, obj.param.y, obj.param.z0, obj.param.radius + mill / 2, 0, 2 * Math.PI, true);
				
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
		cube = new THREE.Mesh(new THREE.CubeGeometry(900,130,8), new THREE.MeshNormalMaterial({transparent: true, color: "orange", opacity: 0.5}));
		//scene.add(cube);
		cube.position.z = -4;
	}
	
	var objects = [];

	var WIDTH = window.innerWidth,
		HEIGHT = window.innerHeight;

	function render() 
	{
		renderer.render( _scene, camera );
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
	
	function init() 
	{
		_scene = new THREE.Scene();

		//scene.fog = new THREE.Fog( 0x111111, 150, 200 );

		root = new THREE.Object3D();

		//scene.add( object );

		try
		{
			renderer = new THREE.WebGLRenderer( { antialias: true } );
			renderer.setClearColor( 0x111111, 1 );
			renderer.setSize( WIDTH, HEIGHT );
		
			var container = document.getElementById( 'container' );
			container.appendChild( renderer.domElement );
		}
		catch (e)
		{
		}
		
		div = $("<div>").appendTo("body").addClass("buttons");
		button = $("<button>").appendTo(div).html("copy gcode").click(that.toText);
		button = $("<button>").appendTo(div).html("perspective view").click(setView.bind(null, PERSPECTIVE));
		button = $("<button>").appendTo(div).html("top view").click(setView.bind(null, TOP));
		button = $("<button>").appendTo(div).html("side view").click(setView.bind(null, SIDE));
		button = $("<button>").appendTo(div).html("front view").click(setView.bind(null, FRONT));
		button = $("<button>").appendTo(div).html("edit source").click(function() {
		});
		button = $("<div>").appendTo(div).html("").attr("id", "time");
		button = $("<div>").appendTo(div).html("<span id=\"label\">calculating best path... jog time</span>: <span id=\"jogtime\"></span><span id=\"stopbuttonw\"> - </span>").attr("id", "pathtime");
		button = $("#stopbuttonw").append($("<a>").html("stop").attr("href", "#").attr("id", "stopbutton"));
		console.log(button);
		$("#stopbutton").click(function()
		{
			that.options.nPathTrials = 1;
		});
		//
		
//		window.addEventListener( 'resize', onWindowResize, false );
	}
		
	var activeRenderer = false;
	function animate() 
	{
		setTimeout( function() {
			requestAnimationFrame( animate );
		}, 100);
		render();
	}
	
	var PERSPECTIVE = 0, TOP = 1, SIDE = 2, FRONT = 3;
	function setView(r) 
	{
		console.log("setting renderer to ", r);
		switch(r) 
		{
			case PERSPECTIVE:
				measures("x", "y", "z");
				camera = new THREE.PerspectiveCamera( 60, WIDTH / HEIGHT, 1, 2500 );
				camera.up.set(0,0,1);
				camera.position.x = 0;
				camera.position.y = -100;
				camera.position.z = 400;
				
				camera.lookAt(new THREE.Vector3(0,0,0));
				controls = new THREE.OrbitControls( camera );
				controls.target.x = (that.max.x+that.min.x) / 2;
				controls.target.y = (that.max.y+that.min.y) / 2;
				controls.target.z = (that.max.z+that.min.z) / 2;
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
	
	this.done = function()
	{
		eval($("textarea").text());
		init();
		this.endPart(false);
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
