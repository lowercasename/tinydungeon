
var randomRange = function r(a, b, c) {
  return parseFloat((Math.random() * ((a ? a : 1) - (b ? b : 0)) + (b ? b : 0)).toFixed(c ? c : 0))
}

var render = function render(particles, ctx, width, height) {
  requestAnimationFrame(function () {
    return render(particles, ctx, width, height)
  })
  ctx.clearRect(0, 0, width, height)
  particles.forEach(function (p, i) {
    p.x += p.speed * Math.cos(p.rotation * Math.PI / 180)
    p.y += p.speed * Math.sin(p.rotation * Math.PI / 180)
    p.opacity -= .005
    p.speed *= p.friction
    p.radius *= p.friction
    p.yVel += p.gravity
    p.y += p.yVel

    if (p.opacity < 0 || p.radius < 0) {
      return
    }

    ctx.beginPath()
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = p.color
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI, false)
    ctx.fill()
  })
  return ctx
}

function explode (opts) {
  if (!opts) {
    throw new Error('Missing options for fireworks')
  }

  var x = opts.x
  var y = opts.y
  var colors = opts.colors
  var parentNode = opts.parentNode || document.body
  var bubbleCount = opts.count || 25

  var particles = []
  var ratio = window.devicePixelRatio
  var c = document.createElement('canvas')
  var ctx = c.getContext('2d')

  c.style.position = 'absolute'
  c.style.left = x - 150 + 'px'
  c.style.top = y - 150 + 'px'
  c.style.pointerEvents = 'none'
  c.style.width = 300 + 'px'
  c.style.height = 300 + 'px'
  c.style.zIndex = 100
  c.width = 300 * ratio
  c.height = 300 * ratio
  parentNode.appendChild(c)

  for (var i = 0; i < bubbleCount; i++) {
    particles.push({
      x: c.width / 2,
      y: c.height / 2,
      radius: randomRange(10, 25),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: randomRange(0, 360, true),
      speed: randomRange(6, 10),
      friction: .96,
      opacity: randomRange(0, .5, true),
      yVel: 0,
      gravity: .05
    })
  }

  render(particles, ctx, c.width, c.height)

  setTimeout(function () {
    parentNode.removeChild(c)
  }, 1000)
}

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.Fireworks = factory()
  }
}(this, function () {
  return explode
}))
