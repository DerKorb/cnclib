

	var program = [];
	
	function ProtoPart(pointIn)
	{
		this.commands = [];
		this.requirements = [];
		this.endPoints = [ pointIn ];
	}
	
	var parts = [];
	var currentPart = new ProtoPart( false );
	var currentZ = false;

	var options = { z_safe: 2, };

	command = function(parts) {
		currentPart.commands.push(parts);
	}
	var G1 = 1, G0 = 0, G2 = 2, G3 = 3;
	
	startPart = function(pointIn)
	{
		if (!currentPart.commands.length)
			return;
		
		parts.push(currentPart);
		
		currentPart = new ProtoPart(pointIn);
	}
	
	endPart = function(pointOut)
	{
		feed({ z: options.z_safe });
		currentPart.endPoints[1] = pointOut;
		startPart();
		return parts.length - 1;
	}

	toText = function() 
	{
/*		params = ["G1", "X"+sanitize(x), "Y"+sanitize(y), "Z"+sanitize(z), "F"+sanitize(speed)];
		if (typeof(x) == "object")
		{
			params = ["G1"];
			for (key in x)
			{
				params.push(key.toUpperCase()+sanitize(x[key]));
			}
		}
		command(params);*/


		program.forEach(function(part) 
		{
			document.write(part.join(" ")+"\n");
		});
	}
	
	heeksStyle = {
		G1: { color: 0x00FF00, dashSize: 1, gapSize: 0.5}, 
		G0: {color: 0xFF0000, dashSize: 1, gapSize: 0}
	};
	linuxCncStyle = {
		G1: {color: 0xFFFFFF, dashSize: 1, gapSize: 0}, 
		G0: {color: "lightblue", dashSize: 1, gapSize: 0.5}
	};
	
	currentStyle = heeksStyle;
	
	_x = false, _y = false, _z = false, _f = false;
	min = {x:10000, y: 10000, z: 10000};
	max = {x:-10000, y: -10000, z: -10000};
	update = function(command)
	{
		if (typeof(command.x) == "number")
			_x = command.x;
		if (typeof(command.y) == "number")
			_y = command.y;
		if (typeof(command.z) == "number")
			_z = command.z;
		if (typeof(command.f) == "number")
			_f = command.f;

		if (_x > max.x) max.x = _x;
		if (_y > max.y) max.y = _y;
		if (_z > max.z) max.z = _z;
		if (_x < min.x) min.x = _x;
		if (_y < min.y) min.y = _y;
		if (_z < min.z) min.z = _z;
	}
	
	time = function()
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
						t+=dist/(command.type==G0 ? 800 : _f);
						break;
					default:
						break;
				}
			});
		});
		
		$("#time").html("<font color=\"darkgreen\">Estimated run time <font color=\"orange\">"+Math.floor(t)+" minutes "+Math.floor(((t-Math.floor(t))*60))+" seconds</font></font>");
	}

	X = 1, Y = 2, Z = 3;
	arrow = function(axis, color)
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
		
	dipIn = function(z, param)
	{
/*		if (z == currentZ)
			return;
*/	
		var speed = options.dipSpeed;
		if (param.dipSpeed != undefined)
			speed = param.dipSpeed;
		
		if (speed != undefined)
			straightFeed( { z: z, speed: speed } );
			
		else
			feed( { z: z } );
	}
	
	rect = function(param) 
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
		
		var fineEdge = (options.fineEdge && param.fineEdge == undefined) || param.fineEdge;
		
		if (fineEdge == undefined || param.width < fineEdge * 2 || param.height < fineEdge * 2)
			fineEdge = 0;
			
		var extendCorners = (options.extendCorners && param.extendCorners == undefined) || param.extendCorners;
		
		var portrait = param.width < param.height;
		var spine = Math.abs(param.width - param.height);
		var span = !portrait ? param.height : param.width;
		
		// xy Steps
		if (!param.stepSize && !param.stepFactor && !param.nSteps)
			param.stepFactor = options.stepFactor;
			
		if (!param.stepSize && !param.nSteps && param.stepFactor)
		{
			console.assert(param.stepFactor > 0 && param.stepFactor <= 1, "stepFactor needs to lie inbetween 0 and 1 (including)");
			param.stepSize = mill * param.stepFactor;
		}
		
		if (param.nSteps != undefined)
			console.assert(span / param.nSteps <= mill, "Not enough steps in rectangle");
		
		if (param.nSteps == undefined)
			param.nSteps = Math.ceil((span - 2 * fineEdge) / param.stepSize) * 0.5;
			
		console.assert(param.nSteps != 0, "Invalid number of steps");
			
		var stepSize = (span - 2 * fineEdge) / Math.floor(2 * param.nSteps);
		
		// z Parameters
		console.assert(param.depth > 0, "objects need to have a positive depth");
		
		if (param.z0 == undefined)
			param.z0 = 0;
			
		console.assert(param.z0 <= 0, "objects need to be below the surface of your material");

		// z Steps
		if (!param.stepSizeZ && !param.stepFactorZ && !param.nStepsZ)
			param.stepFactorZ = options.stepFactorZ;
			
		if (!param.stepSizeZ && !param.nStepsZ && param.stepFactorZ)
		{
			console.assert(param.stepFactorZ > 0, "stepFactorZ cannot be negative");
			param.stepSizeZ = mill * param.stepFactorZ;
		}
		
		if (param.nStepsZ == undefined)
			param.nStepsZ = Math.ceil(param.depth / param.stepSizeZ);
			
		console.assert(param.nStepsZ != 0, "Invalid number of steps in z direction");
			
		var stepSizeZ = param.depth / param.nStepsZ;
		var firstCut = true;
		var lastPoint = false;
		
		for (var z = param.z0 - stepSizeZ; z >= param.z0 - param.depth; z -= stepSizeZ)
		{
			// dip into the material		
			if (param.nSteps % 1 == 0.5)
			{
				// cut the spine (from right to left)
				var p1 = { 	x: param.x + (!portrait ? spine / 2 : 0), 
							y: param.y + ( portrait ? spine / 2 : 0) };

				if (firstCut)
				{
					startPart(p1);
					firstCut = false;
				}

				feed(p1);
				dipIn(z, param);
				
				var p = { 	x: param.x - (!portrait ? spine / 2 : 0), 
							y: param.y - ( portrait ? spine / 2 : 0) };
				
				straightFeed(p);
				lastPoint = p;
			}
			
			for (var s = 0; s < Math.ceil(param.nSteps); s++)
			{
				// cut rect clockwise starting at the top left corner
				var xdiff = (!portrait ? spine / 2 : 0) + s * param.stepSize;
				var ydiff = ( portrait ? spine / 2 : 0) + s * param.stepSize;
			
				var p1 = { 	x: param.x - xdiff,
							y: param.y - ydiff };
				
				if (firstCut)
				{
					startPart(p1);
					feed(p1);
					firstCut = false;
				}
				else
					straightFeed(p1);
					
				var extendCornersDiff = (extendCorners && s == Math.ceil(param.nSteps) - 1) ? (1 - 1 / Math.sqrt(2)) * mill / 2 : 0;
					
				dipIn(z, param);
				
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
			
			if (fineEdge)
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

		return endPart(lastPoint);
	}
	
	drill = function(p)
	{
		startPart();
		
		if (p.r - mill / 2 < 0)
			console.assert("Error! Hole smaller than tool!");
		
		if (!p.x)
			p.x = 0;
		if (!p.y)
			p.y = 0;
		if (!p.z)
			p.z = 0;
		
		if (!p.zsteps)
			p.zsteps = p.d/(mill/2);
		
		if (!p.steps)
			p.steps = p.r/(mill/3);
			
		feed({x: p.x, y: p.y});
		feed({z: p.z});
		for (step = 1; step < p.steps; step++)
		{	
			r = (p.r-mill/2)*step/p.steps;
			feed({x: p.x-r, y: p.y});
			command({type: p.clockwise ? G2 : G3, i: r, j: 0, z: p.z-p.d, p: p.zsteps, x: p.x, y: p.y});
			command({type: p.clockwise ? G2 : G3, i: r, j: 0, z: p.z-p.d, p: 1, x: p.x, y: p.y, d: 0});
			feed({z: p.z});
		}
		
		return endPart();
	}	
	
	var meas = new THREE.Object3D();
	measures = function(primary, secondary, invisible) {
		scene.remove(meas);
		delete meas;
		meas = new THREE.Object3D();
		var line = new THREE.Geometry();
		v1 = new THREE.Vector3();
		v1[primary] = min[primary];
		v1[secondary] = min[secondary]-10;
		v2 = new THREE.Vector3();
		v2[primary] = max[primary];
		v2[secondary] = min[secondary]-10;
		line.vertices.push(v1);
		line.vertices.push(v2);
		meas.add(new THREE.Line( line, new THREE.LineDashedMaterial( {color: "violet"}), THREE.LinePieces ));
		var textGeom = new THREE.TextGeometry((max[primary]-min[primary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, new THREE.MeshBasicMaterial({color: "violet"}));
		textGeom.computeBoundingBox();
		wh = (textGeom.boundingBox.max.x-textGeom.boundingBox.min.x)/2;
		text.position[primary] = (min[primary]+max[primary]-wh);
		text.position[secondary] = min[secondary]-20;
		if (secondary == "z")
			text["rotate"+primary.toUpperCase()](Math.PI/2);
		if (primary == "y")
			text["rotateZ"](Math.PI/2);
		meas.add(text);
		var line = new THREE.Geometry();
		v3 = new THREE.Vector3();
		v3[secondary] = min[secondary];
		v3[primary] = min[primary]-10;
		v4 = new THREE.Vector3();
		v4[secondary] = max[secondary];
		v4[primary] = min[primary]-10;
		line.vertices.push(v3);
		line.vertices.push(v4);
		meas.add(new THREE.Line( line, new THREE.LineDashedMaterial( {color: "violet"}), THREE.LinePieces ));
		textGeom = new THREE.TextGeometry((max[secondary]-min[secondary]).toFixed(2),{font: 'helvetiker', weight: 'normal', size: 8, height: 0});
		var text = new THREE.Mesh(textGeom, new THREE.MeshBasicMaterial({color: "violet"}));
		textGeom.computeBoundingBox();
		wh = (textGeom.boundingBox.max.x-textGeom.boundingBox.min.x)/2;
		
		console.log(textGeom.boundingBox,wh);
		text["rotate"+invisible.toUpperCase()](secondary=="z" && primary == "x" ? -Math.PI/2 : Math.PI/2);
		if (secondary == "z")
		{
			text["rotate"+primary.toUpperCase()](Math.PI/2);
		}
		text.position[secondary] = (min[secondary]+max[secondary]-wh);
		if (primary == "y")
		{
			text["rotateZ"](Math.PI/2);
		}
			text.position[primary] = min[primary]-15;
		meas.add(text);
		scene.add(meas);
		scene.add(meas);
	}
	
	createProgram = function() 
	{
		parts.forEach(function(part)
		{
			part.commands.forEach(function(command) 
			{
				switch (command.type) 
				{
					case G0:
					case G1:
						var line = new THREE.Geometry();
						line.vertices.push(new THREE.Vector3( _x, _y, _z ));
						if (_x == false)
						{
							update(command);
							break;
						}
						else
							update(command);
						line.vertices.push(new THREE.Vector3( _x, _y, _z ));
						line.computeLineDistances();
						if (command.type == G0)
							scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G0 )));
						else
							scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 )));
						break;
					case G2:
					case G3:
						var line = new THREE.Geometry();
						startz = _z;
						for (n = 0; n <= 1.0001; n+=0.002)
						{
							line.vertices.push(new THREE.Vector3( command.x-Math.cos(-n*command.p*2*Math.PI)*command.i, command.y+Math.sin(-n*command.p*2*Math.PI)*command.i, startz+(command.z-startz)*n ));
							update({x: command.x-Math.cos(Math.PI-n*command.p*2*Math.PI)*command.i, z: startz+(command.z-startz)*n, y: command.y+Math.sin(Math.PI-n*command.p*2*Math.PI)*command.i });
						}
						scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 )));
					default:
						break;
				}
			});
		});
		
		arrow(X, 0xFF00FF);
		arrow(Y, 0x00FFFF);
		arrow(Z, 0xFFFF00);
		cube = new THREE.Mesh(new THREE.CubeGeometry(900,130,8), new THREE.MeshNormalMaterial({transparent: true, color: "orange", opacity: 0.5}));
		//scene.add(cube);
		cube.position.z = -4;
	}
	
	
	render = function() {
		renderer.render( scene, camera );
	}
	
	sanitize = function(_var) 
	{
		return typeof(_var)=="number" ? _var.toFixed(3) : _var;
	}
	
	straightFeed = function(x, y, z, speed) 
	{
		if (typeof(x) == "object")
		{
			command({type: G1, x: x.x, y: x.y, z: x.z, f: x.speed});
		}
		else
			command({type: G1, x: x, y: y, z: z, f: speed});
	}
	
	feed = function(x, y, z) 
	{
		if (typeof(x) == "object")
		{
			command({type: G0, x: x.x, y: x.y, z: x.z});
		}
		else
			command({type: G0, x: x, y: y, z: z});
	}
	
	hex = function(x, y, s) 
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
	
	
	var renderer, scene, camera, stats, controls, codeEditor;
	var objects = [];


	var WIDTH = window.innerWidth,
		HEIGHT = window.innerHeight;

	function init() 
	{
		scene = new THREE.Scene();

		//scene.fog = new THREE.Fog( 0x111111, 150, 200 );

		root = new THREE.Object3D();

		//scene.add( object );

		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setClearColor( 0x111111, 1 );
		renderer.setSize( WIDTH, HEIGHT );

		var container = document.getElementById( 'container' );
		container.appendChild( renderer.domElement );
		
		div = $("<div>").appendTo("body").addClass("buttons");
		button = $("<button>").appendTo(div).html("copy gcode");
		button = $("<button>").appendTo(div).html("perspective view").click(setView.bind(null, PERSPECTIVE));
		button = $("<button>").appendTo(div).html("top view").click(setView.bind(null, TOP));
		button = $("<button>").appendTo(div).html("side view").click(setView.bind(null, SIDE));
		button = $("<button>").appendTo(div).html("front view").click(setView.bind(null, FRONT));
		button = $("<button>").appendTo(div).html("edit source").click(function() {
		});
		button = $("<div>").appendTo(div).html("").attr("id", "time");
		//
		
//		window.addEventListener( 'resize', onWindowResize, false );
	}	
		
	activeRenderer = false;
	function animate() 
	{
		requestAnimationFrame( animate );
		render();
	}
	
	PERSPECTIVE = 0, TOP = 1, SIDE = 2, FRONT = 3;
	setView = function(r) 
	{
		console.log("setting renderer to ", r);
		switch(r) 
		{
			case PERSPECTIVE:
				camera = new THREE.PerspectiveCamera( 60, WIDTH / HEIGHT, 1, 2500 );
				camera.up.set(0,0,1);
				camera.position.x = 0;
				camera.position.z = 0;
				camera.position.y = -500;
				camera.lookAt(new THREE.Vector3(0,0,0));
				controls = new THREE.OrbitControls( camera );
				controls.target.x = (max.x+min.x) / 2;
				controls.target.y = (max.y+min.y) / 2;
				controls.target.z = (max.z+min.z) / 2;
				console.log(controls.target);
				render();
				break;
			case SIDE:
				measures("y", "z", "x");
				w1 = 1.1*(max.y-min.y)/2;
				w2 = 1.1*(max.z-min.z)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( w, -w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.y = (max.y+min.y) / 2;
				camera.position.x = min.x;
				camera.position.z = (max.z+min.z) / 2;
				camera.up.set(0,0,1);
				camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI/2);
				camera.lookAt(new THREE.Vector3((max.x+min.x) / 2, (max.y+min.y) / 2, (max.z+min.z) / 2));
				controls = new THREE.OrbitControls( camera, undefined, true  );
				controls.center.x = (max.x+min.x) / 2;
				controls.center.z = (max.z+min.z) / 2;
				controls.center.y = (max.y+min.y) / 2;
				render();
				break;			
			case TOP:
				measures("x", "y", "z");
				w1 = 1.1*(max.x-min.x)/2;
				w2 = 1.1*(max.y-min.y)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( -w, w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.x = (max.x+min.x) / 2;
				camera.position.y = (max.y+min.y) / 2;
				camera.position.z = min.z;
				camera.up.set(0,0,1);
				controls = new THREE.OrbitControls( camera, undefined, true );
				//controls.addEventListener( 'change', render );
				controls.center.x = (max.x+min.x) / 2;
				controls.center.y = (max.y+min.y) / 2;
				controls.center.z = (max.z+min.z) / 2;
				render();
				break;			
			case FRONT:
				w1 = 1.1*(max.x-min.x)/2;
				w2 = 1.1*(max.z-min.z)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				camera = new THREE.OrthographicCamera( w, -w, w*HEIGHT/WIDTH, -w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.z = (max.z+min.z) / 2;
				camera.position.x = (max.x+min.x) / 2;
				camera.up.set(0,0,1);
				camera.lookAt(new THREE.Vector3((max.x+min.x) / 2, (max.y+min.y) / 2, (max.z+min.z) / 2));
				//camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI/2);
				controls = new THREE.OrbitControls( camera, undefined, true );
				//controls.addEventListener( 'change', render );
				controls.center.x = (max.x+min.x) / 2;
				controls.center.y = (max.y+min.y) / 2;
				controls.center.z = (max.z+min.z) / 2;
				measures("x", "z", "y");
				render();
				break;
		}
	}
	
	$(function() {
		eval($("textarea").text());
		init();
		createProgram();
		time();
		setView(TOP);
		animate();
		render();
	});
