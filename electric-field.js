var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
var canvasBg = document.getElementById('canvas_bg');
var contextBg = canvasBg.getContext('2d');

var k = 1;
var numCharges = 12;
var numOrbiters = 3;
var fieldLineCount = 12;
var fieldLineStep = 3;
var chargeGap = 28;
var minForceArrowLength = 10;
var maxForceArrowLength = 42;
var forceArrowScale = 500;
var coulombsPerChargeUnit = 1e-8;
var defaultMinChargeMagnitudeCoulombs = 1e-5;
var defaultMaxChargeMagnitudeCoulombs = 9e-3;
var orbiterChargeMagnitudeCoulombs = 1e-8;
var minChargeMagnitudeCoulombs = defaultMinChargeMagnitudeCoulombs;
var maxChargeMagnitudeCoulombs = defaultMaxChargeMagnitudeCoulombs;
var freeOrbiterLimit = 15;
var maxTestOrbiters = 18;
var simulationMode = 'free';
var showForceArrows = true;
var nextRandomOrbiterIn = 1;
var charges = [];
var orbiters = [];
var draggedCharge = null;
var dragOffsetX = 0;
var dragOffsetY = 0;
var previousTime;
var dt = 0;
var worldWidth = 0;
var worldHeight = 0;
var menuToggle = document.getElementById('menu-toggle');
var menuClose = document.getElementById('menu-close');
var simulationMenu = document.getElementById('simulation-menu');
var menuStatus = document.getElementById('menu-status');
var chargeCountInput = document.getElementById('charge-count');
var freeOrbiterCountInput = document.getElementById('free-orbiter-count');
var freeOrbiterSetting = document.getElementById('free-orbiter-setting');
var fixedChargeSetting = document.getElementById('fixed-charge-setting');
var forceArrowsInput = document.getElementById('show-force-arrows');
var chargeTooltip = document.getElementById('charge-tooltip');
var minChargeMagnitudeInput = document.getElementById('min-charge-magnitude');
var maxChargeMagnitudeInput = document.getElementById('max-charge-magnitude');
var orbiterChargeMagnitudeInput = document.getElementById('orbiter-charge-magnitude');
var chargeMagnitudeError = document.getElementById('charge-magnitude-error');

window.addEventListener('load', init);
window.addEventListener('resize', handleResize);
canvas.addEventListener('pointerdown', startChargeDrag);
window.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerleave', hideChargeTooltip);
canvas.addEventListener('pointerup', stopChargeDrag);
canvas.addEventListener('pointercancel', stopChargeDrag);
canvas.addEventListener('contextmenu', function(event) { event.preventDefault(); });
menuToggle.addEventListener('click', toggleMenu);
menuClose.addEventListener('click', function() { setMenuOpen(false); });
document.getElementById('apply-settings').addEventListener('click', applySettings);
document.getElementById('regenerate-simulation').addEventListener('click', regenerateSimulation);
minChargeMagnitudeInput.addEventListener('input', clearChargeMagnitudeError);
maxChargeMagnitudeInput.addEventListener('input', clearChargeMagnitudeError);
orbiterChargeMagnitudeInput.addEventListener('input', clearChargeMagnitudeError);

function init() {
	resizeCanvases();
	createCharges();
	createOrbiters();
	drawBackground();
	updateModeSettingsVisibility();
	updateMenuStatus();
	previousTime = Date.now();
	requestAnimationFrame(animFrame);
}

function resizeCanvases() {
	var pixelRatio = window.devicePixelRatio || 1;
	worldWidth = window.innerWidth;
	worldHeight = window.innerHeight;
	[canvasBg, canvas].forEach(function(layer) {
		layer.width = Math.round(worldWidth * pixelRatio);
		layer.height = Math.round(worldHeight * pixelRatio);
		layer.style.width = worldWidth + 'px';
		layer.style.height = worldHeight + 'px';
		layer.getContext('2d').setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	});
}

function createCharges() {
	charges = [];
	setChargeCount(numCharges);
}

function setChargeCount(count) {
	numCharges = count;
	if (charges.length > count) charges.length = count;
	while (charges.length < count) {
		var sign = Math.random() < 0.5 ? -1 : 1;
		var magnitudeFraction = Math.random();
		var charge = new Ball(14 + magnitudeFraction * 1.5, sign > 0 ? '#e53935' : '#1976d2', 1,
			sign * chargeMagnitude(magnitudeFraction), true, false);
		charge.magnitudeFraction = magnitudeFraction;
		charge.radius = 14 + magnitudeFraction * 1.5;
		var position = findChargePosition(charge);
		if (!position) break;
		charge.pos2D = position;
		charges.push(charge);
	}
}

function chargeMagnitude(fraction) {
	var magnitude = fraction <= 0 ? minChargeMagnitudeCoulombs
		: fraction >= 1 ? maxChargeMagnitudeCoulombs
			: Math.exp(Math.log(minChargeMagnitudeCoulombs)
				+ (Math.log(maxChargeMagnitudeCoulombs) - Math.log(minChargeMagnitudeCoulombs)) * fraction);
	return magnitude / coulombsPerChargeUnit;
}

function parseChargeMagnitude(value, fallback) {
	var trimmedValue = value.trim();
	if (!trimmedValue) return fallback;
	var scientificExpression = trimmedValue.match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(?:\*|×)?\s*10\s*\^\s*([+-]?\d+)$/);
	var parsedValue = scientificExpression
		? Number(scientificExpression[1].replace(',', '.')) * Math.pow(10, Number(scientificExpression[2]))
		: Number(trimmedValue.replace(',', '.'));
	return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function formatChargeMagnitudeInput(value) {
	var parts = value.toExponential(2).split('e');
	var coefficient = parts[0].replace(/\.?0+$/, '');
	return coefficient + '*10^' + Number(parts[1]);
}

function clearChargeMagnitudeError() {
	chargeMagnitudeError.hidden = true;
	chargeMagnitudeError.textContent = '';
}

function updateChargeMagnitudes(chargesToUpdate) {
	chargesToUpdate.forEach(function(charge) {
		var sign = charge.charge < 0 ? -1 : 1;
		charge.charge = sign * chargeMagnitude(charge.magnitudeFraction);
		charge.radius = 14 + charge.magnitudeFraction * 1.5;
	});
}

function formatScientific(value) {
	var parts = value.toExponential(2).split('e');
	return parts[0] + ' × 10' + toSuperscript(Number(parts[1]));
}

function toSuperscript(value) {
	return String(value).replace('-', '⁻').replace(/[0-9]/g, function(digit) {
		return '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)];
	});
}

function findChargePosition(charge) {
	if (worldWidth < charge.radius * 2 || worldHeight < charge.radius * 2) return null;
	for (var i = 0; i < 1000; i++) {
		var candidate = new Vector2D(
			charge.radius + Math.random() * (worldWidth - charge.radius * 2),
			charge.radius + Math.random() * (worldHeight - charge.radius * 2)
		);
		if (canPlaceCharge(charge, candidate.x, candidate.y)) return candidate;
	}

	var step = charge.radius * 2 + chargeGap;
	for (var y = charge.radius; y <= worldHeight - charge.radius; y += step) {
		for (var x = charge.radius; x <= worldWidth - charge.radius; x += step) {
			if (canPlaceCharge(charge, x, y)) return new Vector2D(x, y);
		}
	}
	return null;
}

function canPlaceCharge(charge, x, y) {
	for (var i = 0; i < charges.length; i++) {
		var other = charges[i];
		if (other === charge) continue;
		if (Math.hypot(x - other.x, y - other.y) < charge.radius + other.radius + chargeGap) {
			return false;
		}
	}
	return true;
}

function createOrbiters() {
	orbiters = [];
	if (simulationMode !== 'free') return;
	for (var i = 0; i < numOrbiters; i++) {
		spawnOrbiter(Math.random() < 0.5 ? -1 : 1);
	}
}

function spawnOrbiter(sign, x, y) {
	var orbiterLimit = simulationMode === 'free' ? freeOrbiterLimit : maxTestOrbiters;
	if (orbiters.length >= orbiterLimit) return false;
	var radius = 5;
	if (typeof x !== 'number' || typeof y !== 'number') {
		var position = findOrbiterPosition(radius);
		if (!position) return false;
		x = position.x;
		y = position.y;
	}
	var orbiterCharge = sign * orbiterChargeMagnitudeCoulombs / coulombsPerChargeUnit;
	var orbiter = new Ball(radius, sign < 0 ? '#1976d2' : '#e53935', 1, orbiterCharge, true, false);
	orbiter.pos2D = new Vector2D(x, y);
	orbiter.velo2D = new Vector2D((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
	orbiters.push(orbiter);
	return true;
}

function findOrbiterPosition(radius) {
	for (var attempt = 0; attempt < 100; attempt++) {
		var point = new Vector2D(
			radius + Math.random() * Math.max(0, worldWidth - radius * 2),
			radius + Math.random() * Math.max(0, worldHeight - radius * 2)
		);
		if (!isInsideCharge(point.x, point.y, radius + 1)) return point;
	}
	return null;
}

function toggleMenu() {
	var isOpen = !simulationMenu.hidden;
	setMenuOpen(!isOpen);
}

function setMenuOpen(isOpen) {
	simulationMenu.hidden = !isOpen;
	document.body.classList.toggle('menu-open', isOpen);
	menuToggle.setAttribute('aria-expanded', String(isOpen));
	menuToggle.setAttribute('aria-label', isOpen ? 'Menü bezárása' : 'Menü megnyitása');
}

function updateModeSettingsVisibility() {
	freeOrbiterSetting.hidden = simulationMode !== 'free';
	fixedChargeSetting.hidden = false;
}

function updateMenuStatus() {
	menuStatus.textContent = simulationMode === 'free'
		? 'A szabad mód aktív: véletlenszerűen mozgó töltések, legfeljebb ' + freeOrbiterLimit + ' darab.'
		: 'A teszt mód aktív: bal kattintás −, jobb kattintás + töltést helyez le.';
}

function applySettings() {
	var requestedMinChargeMagnitude = parseChargeMagnitude(minChargeMagnitudeInput.value, minChargeMagnitudeCoulombs);
	var requestedMaxChargeMagnitude = parseChargeMagnitude(maxChargeMagnitudeInput.value, maxChargeMagnitudeCoulombs);
	var requestedOrbiterChargeMagnitude = parseChargeMagnitude(orbiterChargeMagnitudeInput.value, orbiterChargeMagnitudeCoulombs);
	var selectedMode = document.querySelector('input[name="mode"]:checked');
	var requestedSimulationMode = selectedMode ? selectedMode.value : simulationMode;
	if (requestedMinChargeMagnitude === null || requestedMaxChargeMagnitude === null
		|| requestedOrbiterChargeMagnitude === null
		|| !Number.isFinite(requestedOrbiterChargeMagnitude / coulombsPerChargeUnit)) {
		chargeMagnitudeError.textContent = 'A töltésértékeknek pozitív számnak kell lenniük (például: 9*10^-7).';
		chargeMagnitudeError.hidden = false;
		return;
	}
	if (requestedMinChargeMagnitude > requestedMaxChargeMagnitude) {
		chargeMagnitudeError.textContent = 'A minimális töltés nem lehet nagyobb a maximális töltésnél.';
		chargeMagnitudeError.hidden = false;
		return;
	}
	clearChargeMagnitudeError();
	var requestedChargeCount = Math.max(1, Math.min(18, Math.round(Number(chargeCountInput.value) || 1)));
	var requestedFreeOrbiterLimit = Math.max(1, Math.min(15, Math.round(Number(freeOrbiterCountInput.value) || 1)));
	var chargeMagnitudeChanged = requestedMinChargeMagnitude !== minChargeMagnitudeCoulombs
		|| requestedMaxChargeMagnitude !== maxChargeMagnitudeCoulombs;
	var orbiterChargeMagnitudeChanged = requestedOrbiterChargeMagnitude !== orbiterChargeMagnitudeCoulombs;
	var chargeCountChanged = requestedChargeCount !== numCharges;
	var freeOrbiterLimitChanged = requestedFreeOrbiterLimit !== freeOrbiterLimit;
	var simulationModeChanged = requestedSimulationMode !== simulationMode;
	var forceArrowsChanged = forceArrowsInput.checked !== showForceArrows;

	if (!chargeMagnitudeChanged && !orbiterChargeMagnitudeChanged && !chargeCountChanged && !freeOrbiterLimitChanged
		&& !simulationModeChanged && !forceArrowsChanged) return;

	if (chargeMagnitudeChanged) {
		minChargeMagnitudeCoulombs = requestedMinChargeMagnitude;
		maxChargeMagnitudeCoulombs = requestedMaxChargeMagnitude;
		updateChargeMagnitudes(charges);
	}
	minChargeMagnitudeInput.placeholder = formatChargeMagnitudeInput(minChargeMagnitudeCoulombs);
	maxChargeMagnitudeInput.placeholder = formatChargeMagnitudeInput(maxChargeMagnitudeCoulombs);
	minChargeMagnitudeInput.value = '';
	maxChargeMagnitudeInput.value = '';
	orbiterChargeMagnitudeInput.value = '';
	if (orbiterChargeMagnitudeChanged) {
		orbiterChargeMagnitudeCoulombs = requestedOrbiterChargeMagnitude;
		orbiters.forEach(function(orbiter) {
			orbiter.charge = (orbiter.charge < 0 ? -1 : 1)
				* orbiterChargeMagnitudeCoulombs / coulombsPerChargeUnit;
		});
	}
	orbiterChargeMagnitudeInput.placeholder = formatChargeMagnitudeInput(orbiterChargeMagnitudeCoulombs);

	chargeCountInput.value = String(requestedChargeCount);
	if (chargeCountChanged) setChargeCount(requestedChargeCount);
	freeOrbiterCountInput.value = String(requestedFreeOrbiterLimit);
	freeOrbiterLimit = requestedFreeOrbiterLimit;
	showForceArrows = forceArrowsInput.checked;

	var previousSimulationMode = simulationMode;
	simulationMode = requestedSimulationMode;
	if (simulationModeChanged && simulationMode === 'test') {
		orbiters = [];
	} else if (simulationModeChanged && simulationMode === 'free') {
		createOrbiters();
	} else if (simulationMode === 'free') {
		while (orbiters.length > freeOrbiterLimit) orbiters.pop();
	}
	if (simulationModeChanged) nextRandomOrbiterIn = 1;
	if (simulationModeChanged) updateModeSettingsVisibility();
	if (simulationModeChanged || freeOrbiterLimitChanged) updateMenuStatus();
	if (chargeMagnitudeChanged || chargeCountChanged) drawBackground();
}

function regenerateSimulation() {
	createCharges();
	createOrbiters();
	nextRandomOrbiterIn = 1;
	hideChargeTooltip();
	drawBackground();
}

function handleResize() {
	var oldWidth = worldWidth;
	var oldHeight = worldHeight;
	resizeCanvases();
	if (charges.length) {
		charges.forEach(function(charge) {
			charge.x = oldWidth ? charge.x * worldWidth / oldWidth : worldWidth / 2;
			charge.y = oldHeight ? charge.y * worldHeight / oldHeight : worldHeight / 2;
		});
		orbiters.forEach(function(orbiter) {
			orbiter.x = oldWidth ? orbiter.x * worldWidth / oldWidth : worldWidth / 2;
			orbiter.y = oldHeight ? orbiter.y * worldHeight / oldHeight : worldHeight / 2;
		});
		drawBackground();
	}
}

function drawBackground() {
	contextBg.clearRect(0, 0, worldWidth, worldHeight);
	contextBg.fillStyle = '#fff';
	contextBg.fillRect(0, 0, worldWidth, worldHeight);
	drawFieldLines();
	charges.forEach(drawCharge);
}

function resultantForce(target) {
	var force = Forces.zeroForce();
	charges.forEach(function(source) {
		if (source === target) return;
		var displacement = target.pos2D.subtract(source.pos2D);
		force.incrementBy(Forces.electric(k, source.charge, target.charge, displacement));
	});
	return force;
}

function drawCharge(charge) {
	contextBg.beginPath();
	contextBg.arc(charge.x, charge.y, charge.radius, 0, 2 * Math.PI);
	contextBg.fillStyle = charge.color;
	contextBg.fill();
	contextBg.lineWidth = 2;
	contextBg.strokeStyle = '#fff';
	contextBg.stroke();
	contextBg.fillStyle = '#fff';
	contextBg.font = 'bold ' + Math.round(charge.radius * 1.25) + 'px Arial';
	contextBg.textAlign = 'center';
	contextBg.textBaseline = 'middle';
	contextBg.fillText(charge.charge > 0 ? '+' : '−', charge.x, charge.y + 1);
}

function startChargeDrag(event) {
	var point = pointerPosition(event);
	for (var i = charges.length - 1; i >= 0; i--) {
		var charge = charges[i];
		if (Math.hypot(point.x - charge.x, point.y - charge.y) <= charge.radius) {
			if (simulationMode === 'test' && event.button === 2) {
				charges.splice(i, 1);
				hideChargeTooltip();
				drawBackground();
				event.preventDefault();
				return;
			}
			updateChargeTooltip(charge, event.clientX, event.clientY);
			if (event.button === 0) {
				draggedCharge = charge;
				dragOffsetX = charge.x - point.x;
				dragOffsetY = charge.y - point.y;
				canvas.setPointerCapture(event.pointerId);
				canvas.style.cursor = 'grabbing';
			}
			event.preventDefault();
			return;
		}
	}
	if (simulationMode === 'test' && (event.button === 0 || event.button === 2)) {
		var spawnPosition = findSpawnPosition(point.x, point.y, 5);
		if (spawnPosition) {
			spawnOrbiter(event.button === 0 ? -1 : 1, spawnPosition.x, spawnPosition.y);
		}
		event.preventDefault();
	}
}

function findSpawnPosition(x, y, radius) {
	for (var pass = 0; pass < 3; pass++) {
		for (var i = 0; i < charges.length; i++) {
			var charge = charges[i];
			var dx = x - charge.x;
			var dy = y - charge.y;
			var distance = Math.hypot(dx, dy);
			var minDistance = charge.radius + radius + 2;
			if (distance < minDistance) {
				var angle = distance ? Math.atan2(dy, dx) : 0;
				x = charge.x + Math.cos(angle) * minDistance;
				y = charge.y + Math.sin(angle) * minDistance;
			}
		}
	}
	x = Math.max(radius, Math.min(worldWidth - radius, x));
	y = Math.max(radius, Math.min(worldHeight - radius, y));
	if (isInsideCharge(x, y, radius + 1)) return null;
	return new Vector2D(x, y);
}

function dragCharge(event) {
	if (!draggedCharge) return;
	var point = pointerPosition(event);
	var x = Math.max(draggedCharge.radius, Math.min(worldWidth - draggedCharge.radius, point.x + dragOffsetX));
	var y = Math.max(draggedCharge.radius, Math.min(worldHeight - draggedCharge.radius, point.y + dragOffsetY));
	if (canPlaceCharge(draggedCharge, x, y)) {
		draggedCharge.pos2D = new Vector2D(x, y);
		drawBackground();
	}
	updateChargeTooltip(draggedCharge, event.clientX, event.clientY);
	event.preventDefault();
}

function handlePointerMove(event) {
	if (draggedCharge) {
		dragCharge(event);
		return;
	}
	var point = pointerPosition(event);
	var hoveredCharge = null;
	for (var i = charges.length - 1; i >= 0; i--) {
		var charge = charges[i];
		if (Math.hypot(point.x - charge.x, point.y - charge.y) <= charge.radius) {
			hoveredCharge = charge;
			break;
		}
	}
	if (hoveredCharge) updateChargeTooltip(hoveredCharge, event.clientX, event.clientY);
	else hideChargeTooltip();
}

function updateChargeTooltip(charge, pointerX, pointerY) {
	var sign = charge.charge > 0 ? '+' : '−';
	chargeTooltip.textContent = sign + ' ' + formatScientific(Math.abs(charge.charge * coulombsPerChargeUnit)) + ' C';
	chargeTooltip.style.color = charge.charge > 0 ? '#b4232f' : '#1768a6';
	chargeTooltip.style.borderColor = charge.charge > 0 ? 'rgba(180, 35, 47, 0.3)' : 'rgba(23, 104, 166, 0.3)';
	chargeTooltip.style.background = charge.charge > 0 ? 'rgba(255, 242, 242, 0.94)' : 'rgba(239, 247, 255, 0.94)';
	chargeTooltip.hidden = false;
	var margin = 12;
	var offset = 14;
	var left = Math.min(pointerX + offset, window.innerWidth - chargeTooltip.offsetWidth - margin);
	var top = Math.min(pointerY + offset, window.innerHeight - chargeTooltip.offsetHeight - margin);
	chargeTooltip.style.left = Math.max(margin, left) + 'px';
	chargeTooltip.style.top = Math.max(margin, top) + 'px';
}

function hideChargeTooltip() {
	chargeTooltip.hidden = true;
}

function stopChargeDrag(event) {
	if (!draggedCharge) return;
	draggedCharge = null;
	canvas.style.cursor = 'grab';
	if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

function pointerPosition(event) {
	var rect = canvas.getBoundingClientRect();
	return new Vector2D(
		(event.clientX - rect.left) * worldWidth / rect.width,
		(event.clientY - rect.top) * worldHeight / rect.height
	);
}

function drawFieldLines() {
	var largestChargeMagnitude = charges.reduce(function(largest, charge) {
		return Math.max(largest, Math.abs(charge.charge));
	}, 0);
	if (!largestChargeMagnitude) return;

	charges.forEach(function(charge) {
		var traceDirection = charge.charge > 0 ? 1 : -1;
		var color = charge.charge > 0 ? 'rgba(229, 57, 53, 0.78)' : 'rgba(25, 118, 210, 0.78)';
		var relativeMagnitude = Math.sqrt(Math.abs(charge.charge) / largestChargeMagnitude);
		var lineCount = Math.round(fieldLineCount * (0.5 + 0.5 * relativeMagnitude) * 3.4);
		for (var i = 0; i < lineCount; i++) {
			var angle = 2 * Math.PI * i / lineCount;
			traceFieldLine(charge, angle, traceDirection, color);
		}
	});
}

function traceFieldLine(charge, angle, traceDirection, color) {
	var startDistance = charge.radius + 2;
	var x = charge.x + Math.cos(angle) * startDistance;
	var y = charge.y + Math.sin(angle) * startDistance;
	var maxSteps = Math.ceil(Math.hypot(worldWidth, worldHeight) * 2 / fieldLineStep);

	contextBg.beginPath();
	contextBg.moveTo(x, y);
	for (var i = 0; i < maxSteps; i++) {
		var next = rk4Step(x, y, fieldLineStep, traceDirection);
		if (!next || next.x < 0 || next.x > worldWidth || next.y < 0 || next.y > worldHeight) {
			break;
		}
		x = next.x;
		y = next.y;
		contextBg.lineTo(x, y);
		if (isInsideCharge(x, y)) {
			break;
		}
	}
	contextBg.strokeStyle = color;
	contextBg.lineWidth = 1.35;
	contextBg.stroke();
}

function rk4Step(x, y, step, direction) {
	var a = fieldDirection(x, y, direction);
	if (!a) return null;
	var b = fieldDirection(x + a.x * step / 2, y + a.y * step / 2, direction);
	if (!b) return null;
	var c = fieldDirection(x + b.x * step / 2, y + b.y * step / 2, direction);
	if (!c) return null;
	var d = fieldDirection(x + c.x * step, y + c.y * step, direction);
	if (!d) return null;
	return new Vector2D(
		x + step * (a.x + 2 * b.x + 2 * c.x + d.x) / 6,
		y + step * (a.y + 2 * b.y + 2 * c.y + d.y) / 6
	);
}

function fieldDirection(x, y, direction) {
	var ex = 0;
	var ey = 0;
	for (var i = 0; i < charges.length; i++) {
		var dx = x - charges[i].x;
		var dy = y - charges[i].y;
		var distanceSquared = dx * dx + dy * dy;
		if (distanceSquared < 1) return null;
		var scale = charges[i].charge / (distanceSquared * Math.sqrt(distanceSquared));
		ex += dx * scale;
		ey += dy * scale;
	}
	var magnitude = Math.hypot(ex, ey);
	if (magnitude < 1e-12) return null;
	return new Vector2D(direction * ex / magnitude, direction * ey / magnitude);
}

function isInsideCharge(x, y, clearance) {
	if (typeof clearance !== 'number') clearance = 1;
	for (var i = 0; i < charges.length; i++) {
		if (Math.hypot(x - charges[i].x, y - charges[i].y) <= charges[i].radius + clearance) {
			return true;
		}
	}
	return false;
}

function animFrame() {
	onTimer();
	requestAnimationFrame(animFrame);
}

function onTimer() {
	var now = Date.now();
	dt = Math.min((now - previousTime) / 1000, 0.05);
	previousTime = now;
	move();
}

function move() {
	context.clearRect(0, 0, worldWidth, worldHeight);
	if (simulationMode === 'free') {
		nextRandomOrbiterIn -= dt;
		if (nextRandomOrbiterIn <= 0) {
			if (Math.random() < 0.75) spawnOrbiter(Math.random() < 0.5 ? -1 : 1);
			nextRandomOrbiterIn = 0.5 + Math.random() * 1.5;
		}
	}
	orbiters.forEach(function(orbiter) {
		var force = Forces.zeroForce();
		var shouldRecycle = false;
		charges.forEach(function(charge) {
			var distance = orbiter.pos2D.subtract(charge.pos2D);
			if (distance.length() <= charge.radius + orbiter.radius) {
				shouldRecycle = true;
				return;
			}
			force.incrementBy(Forces.electric(k, charge.charge, orbiter.charge, distance));
		});
		if (shouldRecycle) {
			if (simulationMode === 'free') recycleOrbiter(orbiter);
			else orbiter.remove = true;
		} else {
			orbiter.velo2D = orbiter.velo2D.addScaled(force.multiply(1 / orbiter.mass), dt);
			orbiter.pos2D = orbiter.pos2D.addScaled(orbiter.velo2D, dt);
			if (orbiter.x < 0 || orbiter.x > worldWidth || orbiter.y < 0 || orbiter.y > worldHeight) {
				if (simulationMode === 'free') recycleOrbiter(orbiter);
				else orbiter.remove = true;
			}
		}
		if (!orbiter.remove) {
			orbiter.draw(context);
			if (showForceArrows) drawForceArrow(context, orbiter, resultantForce(orbiter));
		}
	});
	orbiters = orbiters.filter(function(orbiter) { return !orbiter.remove; });
}

function drawForceArrow(ctx, orbiter, force) {
	var magnitude = force.length();
	if (magnitude < 1e-12) return;
	var direction = force.multiply(1 / magnitude);
	var strengthRatio = Math.sqrt(magnitude / (magnitude + forceArrowScale));
	var length = minForceArrowLength + (maxForceArrowLength - minForceArrowLength) * strengthRatio * 2.5;
	var startX = orbiter.x + direction.x * (orbiter.radius + 2);
	var startY = orbiter.y + direction.y * (orbiter.radius + 2);
	var endX = startX + direction.x * length;
	var endY = startY + direction.y * length;
	var angle = Math.atan2(direction.y, direction.x);
	var headLength = 7;
	var headAngle = Math.PI / 7;

	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.lineTo(endX, endY);
	ctx.moveTo(endX - headLength * Math.cos(angle - headAngle), endY - headLength * Math.sin(angle - headAngle));
	ctx.lineTo(endX, endY);
	ctx.lineTo(endX - headLength * Math.cos(angle + headAngle), endY - headLength * Math.sin(angle + headAngle));
	ctx.strokeStyle = '#263746';
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';
	ctx.stroke();
}

function recycleOrbiter(orbiter) {
	orbiter.pos2D = new Vector2D(Math.random() * worldWidth, Math.random() * worldHeight);
	orbiter.velo2D = new Vector2D((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
}
