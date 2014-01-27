	program = [];

	command = function(parts) {
		program.push(parts);
	}
	G1 = 1, G0 = 0, G2 = 2, G3 = 3;

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


	program.forEach(function(parts)
		{
			document.write(parts.join(" ")+"\n");
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
	
	currentStyle = linuxCncStyle;
	
	_x = 0, _y = 0, _z = 0, _f = 0;
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
		_x = 0;
		_y = 0;
		_z = 0;
		_f = 800;
		t = 0;
		program.forEach(function(command) {
			switch (command.type) 
			{
				case G0:
				case G1:
					ox = _x;
					oy = _y;
					oz = _z;
					update(command);
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
	
	drill = function(r) 
	{
		feed({z:2});
	}
	
	TL = 0, TR = 1, BR = 2, BL = 3;
	XYF = function(r, corner, step)
	{
		mn = (r.w-r.h);
		longside  = mn > 0 ? "x" : "y";
		shortside = mn > 0 ? "y" : "x";
		o = r.f ? {f: r.f} : {};
		if (mn<0)
			mn = -mn;
		switch (corner) 
		{
			case TL:
				o[longside] = r[longside]-step*r.offset-mn/2;
				o[shortside] = r[shortside]-step*r.offset;
				break;
			case TR:
				o[longside] = r[longside]+step*r.offset+mn/2;
				o[shortside] = r[shortside]-step*r.offset;
				break;
			case BR:
				o[longside] = r[longside]+step*r.offset+mn/2;
				o[shortside] = r[shortside]+step*r.offset;
				break;
			case BL:
				o[longside] = r[longside]-step*r.offset-mn/2;
				o[shortside] = r[shortside]+step*r.offset;
				break;
		}
		if (o.x>r.x+r.w/2-mill/2)
			o.x = r.x+r.w/2-mill/2;
		if (o.x<r.x-r.w/2+mill/2)
			o.x = r.x-r.w/2+mill/2;
		if (o.y>r.y+r.h/2-mill/2)
			o.y = r.y+r.h/2-mill/2;
		if (o.y<r.y-r.h/2+mill/2)
			o.y = r.y-r.h/2+mill/2;
		return o;
	}
	
	rect = function(r) 
	{
		if (!r.h)
			r.h = r.w;
		if (!r.offset)
			r.offset = mill/2;
		if (!r.x)
			x = 0;
		if (!r.y)
			r.y = 0;
		if (!r.z)
			r.z = 0;

		feed(XYF(r, 0, 0));
		feed(r);
		
		
		for(step=0; step<=r.steps; step++)
		{
			straightFeed({z: r.z-r.d*step/r.steps});
			for (offset=0; offset < (r.w < r.h ? r.w : r.h)/r.offset/2; offset++)
				for (corner=0; corner < 5; corner++)
					straightFeed(XYF(r, corner%4, offset));
		}
		feed({z:2});
	}
	
	drill = function(p)
	{
		/*if (p.r-mill/2 < 0)
			console.log("Error! Hole smaller than tool!");*/
		
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
			command({type: p.clockwise ? G2 : G3, i: r, j: 0, z: p.z-p.d, p: p.zsteps, x: p.x, y: p.y})
			command({type: p.clockwise ? G2 : G3, i: r, j: 0, z: p.z-p.d, x: p.x, y: p.y})
			feed({z: p.z});
		}
		feed({x: p.x, y: p.y});
		feed({z: 2});
	}	
	
	createProgram = function() 
	{
		program.forEach(function(command) {
			switch (command.type) 
			{
				case G0:
				case G1:
					var line = new THREE.Geometry();
					line.vertices.push(new THREE.Vector3( _x, _y, _z ));
					update(command);
					line.vertices.push(new THREE.Vector3( _x, _y, _z ));
					line.computeLineDistances();
					if (command.type == G0)
						scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G0 ), THREE.LineStrip));
					else
						scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 ), THREE.LineStrip));
					break;
				case G2:
				case G3:
					var line = new THREE.Geometry();
					startz = _z;
					for (n = 0; n <= 1; n+=0.02)
					{
						line.vertices.push(new THREE.Vector3( command.x+Math.cos(n*command.p*2*Math.PI)*command.i, command.y+Math.sin(n*command.p*2*Math.PI)*command.i, startz+command.z*n ));
						update({x: command.x+Math.cos(n*command.p*2*Math.PI)*command.i, z: startz+command.z*n, y: command.y+Math.sin(n*command.p*2*Math.PI)*command.i });
					}
					scene.add(new THREE.Line( line, new THREE.LineDashedMaterial( currentStyle.G1 )));
				default:
					break;
			}
		});
		arrow(X, 0xFF00FF);
		arrow(Y, 0x00FFFF);
		arrow(Z, 0xFFFF00);
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
			command({type: G0, x: x.x, y: x.y, z: x.z, f: x.speed});
		}
		else
			command({type: G0, x: x, y: y, z: z});
	}
	
	hex = function(x, y, s) {
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

	function init() {
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
	function animate() {
		controls.update();
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
				camera.position.y = 350;
				camera.lookAt(new THREE.Vector3(0,0,0));
				controls = new THREE.OrbitControls( camera );
				controls.target.x = (max.x+min.x) / 2;
				controls.target.y = (max.y+min.y) / 2;
				controls.target.z = (max.z+min.z) / 2;
				console.log(controls.target);
				render();
				break;
			case SIDE:
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
				w1 = 1.1*(max.x-min.x)/2;
				w2 = 1.1*(max.y-min.y)/2;
				w = w1 > w2 ? w1 : w2*WIDTH/HEIGHT;
				//camera = new THREE.OrthographicCamera( min.y-20, max.y+20, max.z+20, min.z-20, 1, 500 );
				camera = new THREE.OrthographicCamera( w, -w, -w*HEIGHT/WIDTH, w*HEIGHT/WIDTH, -1000, 1000 );
				camera.position.x = (max.x+min.x) / 2;
				camera.position.y = (max.y+min.y) / 2;
				//camera.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI/2);
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
				//camera = new THREE.OrthographicCamera( min.y-20, max.y+20, max.z+20, min.z-20, 1, 500 );
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
				render();
				break;
		}
	}
	
	$(function() {
		eval($("textarea").text());
		init();
		createProgram();
		time();
		setView(PERSPECTIVE);
		animate();
		render();
	});