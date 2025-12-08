(() => {
	// plugins
	Matter.use(MatterAttractors);

	// constants
	const PATHS = {
		DOME: '0 0 0 250 19 250 20 231.9 25.7 196.1 36.9 161.7 53.3 129.5 74.6 100.2 100.2 74.6 129.5 53.3 161.7 36.9 196.1 25.7 231.9 20 268.1 20 303.9 25.7 338.3 36.9 370.5 53.3 399.8 74.6 425.4 100.2 446.7 129.5 563.1 261.7 574.3 396.1 580 431.9 580 350 600 350 600 0 0 0',
		DROP_LEFT: '0 0 20 0 70 100 20 150 0 150 0 0',
		DROP_RIGHT: '50 0 68 0 68 150 50 150 0 100 50 0',
		APRON_LEFT: '0 0 180 120 0 120 0 0',
		APRON_RIGHT: '180 0 180 120 0 120 180 0'
	};
	const COLOR = {
		BACKGROUND: '#212529',
		OUTER: '#495057',
		INNER: '#15aabf',
		BUMPER: '#fab005',
		BUMPER_LIT: '#fff3bf',
		PADDLE: '#e64980',
		PINBALL: '#dee2e6',
		TEST: '#ff0000ff'
	};
const GRAVITY = 0.45;       // 0.75 → 0.45  (bi rơi chậm hơn)
const WIREFRAMES = false;
const BUMPER_BOUNCE = 1.1;  // 1.5 → 1.1   (độ nảy yếu hơn)
const PADDLE_PULL = 0.0012; // 0.002 → 0.0012 (paddle bật nhẹ hơn)
const MAX_VELOCITY = 25;    // 50 → 25     (giới hạn tốc độ bi thấp hơn)


	// score elements
	let $currentScore = $('.current-score span');
	let $highScore = $('.high-score span');

	// shared variables
	let currentScore, highScore;
	let engine, world, render, pinball, stopperGroup;
	let leftPaddle, leftUpStopper, leftDownStopper, isLeftPaddleUp;
	let rightPaddle, rightUpStopper, rightDownStopper, isRightPaddleUp;

	function load() {
		init();
		createStaticBodies();
		createPaddles();
		createPinball();
		createEvents();
	}

	function init() {
		// engine (shared)
		engine = Matter.Engine.create();

		// world (shared)
		world = engine.world;
		world.bounds = {
	min: { x: 0, y: 0},
	max: { x: 600, y: 800 }
};

		world.gravity.y = GRAVITY; // simulate rolling on a slanted table

		// render (shared)
		render = Matter.Render.create({
			element: $('.container')[0],
			engine: engine,
			options: {
    width: 600,
    height: 800,
    wireframes: WIREFRAMES,
     background: "transparent" 
}
		});
		Matter.Render.run(render);

		// runner
		let runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		// used for collision filtering on various bodies
		stopperGroup = Matter.Body.nextGroup(true);

		// starting values
		currentScore = 0;
		highScore = 0;
		isLeftPaddleUp = false;
		isRightPaddleUp = false;
	}

	function createStaticBodies() {
    Matter.World.add(world, [
        // boundaries
        boundary(300, -30, 600, 100),      // 250→300
        boundary(300, 830, 600, 100),
        boundary(-30, 400, 100, 800),
        boundary(630, 400, 100, 800),      // 530→630

        // dome
        path(239, 86, PATHS.DOME),         // 239→289

        // pegs
        wall(220, 140, 20, 40, COLOR.INNER), // 140→190
        wall(300, 140, 20, 40, COLOR.INNER), // 225→275
        wall(380, 140, 20, 40, COLOR.INNER), // 310→360

        // top bumpers
        bumper(200, 250),
        bumper(300, 250),
        bumper(400, 250),

        // bottom bumpers
        bumper(250, 340),
        bumper(350, 340),

        // shooter lane wall

        // drops


        // slingshots
  

        // out lane walls
        wall(60, 529, 20, 160, COLOR.INNER),
        wall(540, 529, 20, 160, COLOR.INNER),

        // flipper walls
        wall(104, 630, 20, 120, COLOR.INNER, -0.96),
        wall(494, 630, 20, 120, COLOR.INNER, 0.96),

        // aprons
        path(70, 740, PATHS.APRON_LEFT),
        path(480, 740, PATHS.APRON_RIGHT),

        // reset zones
        reset(300, 500),    // 225→275
        reset(500, 50)     // 465→515
    ]);
}

function createPaddles() {

    // STOPPERS
    leftUpStopper   = stopper(210, 591 + 40, 'left', 'up');       // +40
    leftDownStopper = stopper(190, 743 + 40, 'left', 'down');     // +40

    rightUpStopper  = stopper(340 + 50, 591 + 40, 'right', 'up'); // +50 X, +40 Y
    rightDownStopper= stopper(360 + 50, 743 + 40, 'right', 'down');

    Matter.World.add(world, [
        leftUpStopper, 
        leftDownStopper, 
        rightUpStopper, 
        rightDownStopper
    ]);

    let paddleGroup = Matter.Body.nextGroup(true);

    // LEFT PADDLE (hạ Y +40)
    let paddleLeft = {};

    paddleLeft.paddle = Matter.Bodies.trapezoid(220, 660 + 40, 20, 80, 0.33, {
        label: 'paddleLeft',
        angle: 1.57,
        chamfer: {},
        render: { fillStyle: COLOR.PADDLE }
    });

    paddleLeft.brick = Matter.Bodies.rectangle(222, 672 + 40, 40, 80, {
        angle: 1.62,
        chamfer: {},
        render: { visible: false }
    });

    paddleLeft.comp = Matter.Body.create({
        label: 'paddleLeftComp',
        parts: [paddleLeft.paddle, paddleLeft.brick]
    });

    paddleLeft.hinge = Matter.Bodies.circle(192, 660 + 40, 5, {
        isStatic: true,
        render: { visible: false }
    });

    Object.values(paddleLeft).forEach(p => p.collisionFilter.group = paddleGroup);

    paddleLeft.con = Matter.Constraint.create({
        bodyA: paddleLeft.comp,
        pointA: { x: -29.5, y: -8.5 },
        bodyB: paddleLeft.hinge,
        length: 0,
        stiffness: 0
    });

    Matter.World.add(world, [
        paddleLeft.comp,
        paddleLeft.hinge,
        paddleLeft.con
    ]);

    Matter.Body.rotate(paddleLeft.comp, 0.57, { x: 192, y: 660 + 40 });



    // RIGHT PADDLE (hạ Y +40, lệch X +50)
    let paddleRight = {};

    paddleRight.paddle = Matter.Bodies.trapezoid(330 + 50, 660 + 40, 20, 80, 0.33, {
        label: 'paddleRight',
        angle: -1.57,
        chamfer: {},
        render: { fillStyle: COLOR.PADDLE }
    });

    paddleRight.brick = Matter.Bodies.rectangle(328 + 50, 672 + 40, 40, 80, {
        angle: -1.62,
        chamfer: {},
        render: { visible: false }
    });

    paddleRight.comp = Matter.Body.create({
        label: 'paddleRightComp',
        parts: [paddleRight.paddle, paddleRight.brick]
    });

    paddleRight.hinge = Matter.Bodies.circle(358 + 50, 660 + 40, 5, {
        isStatic: true,
        render: { visible: false }
    });

    Object.values(paddleRight).forEach(p => p.collisionFilter.group = paddleGroup);

    paddleRight.con = Matter.Constraint.create({
        bodyA: paddleRight.comp,
        pointA: { x: 29.5, y: -8.5 },
        bodyB: paddleRight.hinge,
        length: 0,
        stiffness: 0
    });

    Matter.World.add(world, [
        paddleRight.comp,
        paddleRight.hinge,
        paddleRight.con
    ]);

    Matter.Body.rotate(paddleRight.comp, -0.57, { x: 358 + 50, y: 660 + 40 });
}


function createPinball() {
    pinball = Matter.Bodies.circle(0, 0, 14, {
        label: 'pinball',
        collisionFilter: {
            group: stopperGroup
        },
        render: {
            fillStyle: COLOR.PINBALL
        }
    });

    Matter.World.add(world, pinball);

    launchPinball();
}

// Pinball spawn ALSO needs update (X +50)
function launchPinball() {
    updateScore(0);

    Matter.Body.setPosition(pinball, { 
        x: 685,   // 465 → 515
        y: 765 
    });

    Matter.Body.setVelocity(pinball, { 
        x: 0, 
        y: -25 
    });

    Matter.Body.setAngularVelocity(pinball, 0);
}

	function createPinball() {
		// x/y are set to when pinball is launched
		pinball = Matter.Bodies.circle(0, 0, 14, {
			label: 'pinball',
			collisionFilter: {
				group: stopperGroup
			},
			render: {
				fillStyle: COLOR.PINBALL
			}
		});
		Matter.World.add(world, pinball);
		launchPinball();
	}

	function createEvents() {
		// events for when the pinball hits stuff
		Matter.Events.on(engine, 'collisionStart', function(event) {
			let pairs = event.pairs;
			pairs.forEach(function(pair) {
				if (pair.bodyB.label === 'pinball') {
					switch (pair.bodyA.label) {
						case 'reset':
							launchPinball();
							break;
						case 'bumper':
							pingBumper(pair.bodyA);
							break;
					}
				}
			});
		});

		// regulate pinball
		Matter.Events.on(engine, 'beforeUpdate', function(event) {
			// bumpers can quickly multiply velocity, so keep that in check
			Matter.Body.setVelocity(pinball, {
				x: Math.max(Math.min(pinball.velocity.x, MAX_VELOCITY), -MAX_VELOCITY),
				y: Math.max(Math.min(pinball.velocity.y, MAX_VELOCITY), -MAX_VELOCITY),
			});

			// cheap way to keep ball from going back down the shooter lane
			if (pinball.position.x > 450 && pinball.velocity.y > 0) {
				Matter.Body.setVelocity(pinball, { x: 0, y: -10 });
			}
		});

		// mouse drag (god mode for grabbing pinball)
		Matter.World.add(world, Matter.MouseConstraint.create(engine, {
			mouse: Matter.Mouse.create(render.canvas),
			constraint: {
				stiffness: 0.2,
				render: {
					visible: false
				}
			}
		}));

		// keyboard paddle events
		$('body').on('keydown', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = true;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = true;
			}
		});
		$('body').on('keyup', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = false;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = false;
			}
		});

		// click/tap paddle events
		$('.left-trigger')
			.on('mousedown touchstart', function(e) {
				isLeftPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isLeftPaddleUp = false;
			});
		$('.right-trigger')
		.on('mousedown touchstart', function(e) {
				isRightPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isRightPaddleUp = false;
			});
	}

	function launchPinball() {
		updateScore(0);
		Matter.Body.setPosition(pinball, { x: 465, y: 765 });
		Matter.Body.setVelocity(pinball, { x: 0, y: -25 + rand(-2, 2) });
		Matter.Body.setAngularVelocity(pinball, 0);
	}

	function pingBumper(bumper) {
		updateScore(currentScore + 10);

		// flash color
		bumper.render.fillStyle = COLOR.BUMPER_LIT;
		setTimeout(function() {
			bumper.render.fillStyle = COLOR.BUMPER;
		}, 100);
	}

	function updateScore(newCurrentScore) {
		currentScore = newCurrentScore;
		$currentScore.text(currentScore);

		highScore = Math.max(currentScore, highScore);
		$highScore.text(highScore);
	}

	// matter.js has a built in random range function, but it is deterministic
	function rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	// outer edges of pinball table
	function boundary(x, y, width, height) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			isStatic: true,
			render: {
            visible: false
        }
		});
	}

	// wall segments
	function wall(x, y, width, height, color, angle = 0) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			angle: angle,
			isStatic: true,
			chamfer: { radius: 10 },
			 render: {
            visible: false
        }
		});
	}

	// bodies created from SVG paths
	function path(x, y, path) {
		let vertices = Matter.Vertices.fromPath(path);
		return Matter.Bodies.fromVertices(x, y, vertices, {
			isStatic: true,
			render: {
            visible: false
        }
		});
	}

	// round bodies that repel pinball
	function bumper(x, y) {
		let bumper = Matter.Bodies.circle(x, y, 25, {
			label: 'bumper',
			isStatic: true,
		 render: {
            visible: false
        }
		});

		// for some reason, restitution is reset unless it's set after body creation
		bumper.restitution = BUMPER_BOUNCE;

		return bumper;
	}

	// invisible bodies to constrict paddles
	function stopper(x, y, side, position) {
		// determine which paddle composite to interact with
		let attracteeLabel = (side === 'left') ? 'paddleLeftComp' : 'paddleRightComp';

		return Matter.Bodies.circle(x, y, 40, {
			isStatic: true,
			render: {
				visible: false,
			},
			collisionFilter: {
				group: stopperGroup
			},
			plugin: {
				attractors: [
					// stopper is always a, other body is b
					function(a, b) {
						if (b.label === attracteeLabel) {
							let isPaddleUp = (side === 'left') ? isLeftPaddleUp : isRightPaddleUp;
							let isPullingUp = (position === 'up' && isPaddleUp);
							let isPullingDown = (position === 'down' && !isPaddleUp);
							if (isPullingUp || isPullingDown) {
								return {
									x: (a.position.x - b.position.x) * PADDLE_PULL,
									y: (a.position.y - b.position.y) * PADDLE_PULL,
								};
							}
						}
					}
				]
			}
		});
	}

	// contact with these bodies causes pinball to be relaunched
	function reset(x, width) {
		return Matter.Bodies.rectangle(x, 781, width, 2, {
			label: 'reset',
			isStatic: true,
			render: {
				fillStyle: '#fff'
			}
		});
	}

	window.addEventListener('load', load, false);
})();