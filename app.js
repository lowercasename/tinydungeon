const path = require('path');
const views = require('koa-views');
const logger = require('koa-logger');
const router = require('koa-router')();
const static = require('koa-static');
const koaBody = require('koa-body');
const koaRequest = require('koa-http-request')
const fs = require('fs');

const handlebars = require('handlebars')
// const repeat = require('handlebars-helper-repeat');

const dr = require("./node_modules/rpg-dice-roller/dice-roller.js");
const diceRoller = new dr.DiceRoller();

var apiUrl = 'https://app.roll20.net/compendium/dnd5e/';

const Koa = require('koa');
const app = module.exports = new Koa();

var moniker = require('moniker');
var roomName = moniker.generator([moniker.adjective, moniker.noun]);

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)

var Pusher = require('pusher');

var pusher = new Pusher({
  appId: '575253',
  key: 'b7fdcc5991e812a9a79e',
  secret: '9e54e0c3682e9003d048',
  cluster: 'eu',
  encrypted: true
});

db.defaults({
  rooms: []
})
  .write()

const shortid = require('shortid');

const moment = require('moment');

const schedule = require('node-schedule');

const cleanDatabase = schedule.scheduleJob('59 23 * * *', function (fireDate) {
  const too_old = moment().subtract(30, 'days').format("X");
  const filter = db.get("rooms")
    .filter(room => too_old > moment(room.modtime).format("X"))
    .remove()
    .write()
  var arrayLength = filter.length;
  for (var i = 0; i < arrayLength; i++) {
    db.get("rooms").remove({ "id": filter[i]["id"] }).write();
  }
  console.log("Removed old entries!")
  console.log('This job was supposed to run at ' + fireDate + ', but actually ran at ' + new Date());
});

app.use(logger());

app.use(static(__dirname + '/static'));

app.use(koaRequest({
  json: true,
  timeout: 3000,
  host: apiUrl
}));

app.use(views(path.join(__dirname, '/views'), {
  map: {
    html: 'handlebars'
  },
  options: {
    partials: {
      base_layout: './layouts/base',
      header: './partials/_header',
      footer: './partials/_footer',
      pog: './partials/_pog'
    },
    helpers: {
      statbonus: (stat) => { return ((Math.floor((parseInt(stat) - 10) / 2) > -1) ? "+" + Math.floor((parseInt(stat) - 10) / 2) : Math.floor((parseInt(stat) - 10) / 2)) },
      for: (from, to, incr, block) => {
        var accum = '';
        for (var i = from; i < to; i += incr)
          accum += block.fn(i);
        return accum;
      },
      math: (lvalue, operator, rvalue) => {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);
        return {
          "+": lvalue + rvalue,
          "-": lvalue - rvalue,
          "*": lvalue * rvalue,
          "/": lvalue / rvalue,
          "%": lvalue % rvalue
        }[operator];
      },
      cells: (context) => {
        console.log(context);
        let html = '';
        let tableWidth = 64;
        let gridSize = Math.pow(tableWidth, 2)
        for (var i = 0; i < gridSize; i++) {
          let row = Math.floor(i / tableWidth) + 1;
          let column = (i % tableWidth) + 1;
          let contextCell = context.find(cell => parseInt(cell.row) === row && parseInt(cell.column) === column)
          let pogHtml = '';
          if (contextCell && contextCell.pogs) {
            contextCell.pogs.forEach(pog => {
              pogHtml += `<span class="pog" data-id="${pog.pog_id}" style="width: ${pog.pog_size}; height: ${pog.pog_size};">${pog.pog_label}</span>`
            })
          }
          html += `<div title="Row ${row}, column ${column}" class="grid__cell" data-row="${row}" data-column="${column}" data-color="${contextCell ? contextCell.color : 'white'}" data-id="${contextCell ? contextCell.id : ''}">
            ${pogHtml ? pogHtml : ''}
          </div>`
        }
        return html;
      }
    }
  }
}));

app.use(koaBody());

router.get('/', index)
  .get('/new/room', add_room)
  .get('/dungeon/:name', show)
  .post('/add_member', add_member)
  .post('/edit_member', edit_member)
  .post('/delete_member', delete_member)
  .get('/delete_room', delete_room)
  .post('/generate_monster', generate_monster)
  .post('/edit_map', edit_map)
  .post('/edit_color', edit_color)
  .post('/clear_map', clear_map)
  .get('/download_map', koaBody(), download_map)
  .get('/download_participants', koaBody(), download_participants)
  .post('/import_participants', koaBody(), import_participants)

app.use(router.routes());

app.use(async (ctx, next) => {
  try {
    await next()
    if (ctx.status === 404) {
      await ctx.render('404');
    }
  } catch (err) {
    // handle error
  }
})

async function index(ctx) {
  const rooms = db.get("rooms")
    .value()
  await ctx.render('index', { rooms: rooms });
}

async function show(ctx) {
  const name = ctx.params.name;
  const room = db.get("rooms")
    .find({ name: name })
    .value();
  if (room) {
    room.members.sort(function (a, b) {
      return b.init - a.init
    })
  }
  const now = new Date()
  const modtime_update = db.get('rooms')
    .find({ name: name })
    .assign({ modtime: now })
    .write()
  if (!room) {
    await ctx.render('404');
  }
  else {

    await ctx.render('show', { room: room });
  }
}

async function add_room(ctx) {
  const name = roomName.choose()
  const now = new Date()
  const room = db.get('rooms')
    .push({
      id: shortid.generate(),
      name: name,
      members: [],
      cells: [],
    })
    .write()
  ctx.redirect('/dungeon/' + name);
}

async function delete_room(ctx) {
  const room_id = ctx.query.room_id
  const room = db.get('rooms')
    .remove({ id: room_id })
    .write()
  ctx.redirect('/');
}

async function add_member(ctx) {
  const room_name = ctx.query.room
  const new_id = shortid.generate()
  const member = db.get('rooms')
    .find({ name: ctx.query.room })
    .get('members')
    .push({
      id: new_id,
      name: ctx.query.name,
      init: ctx.query.init,
      ac: ctx.query.ac,
      hp: ctx.query.hp,
      chp: ctx.query.hp,
      notes: ""
    })
    .write()
  pusher.trigger('dungeon-events', 'table-add', { room_name: room_name });
  ctx.response.body = new_id
  ctx.status = 200
}

async function edit_member(ctx) {
  console.log(ctx.request.body)
  const room_name = ctx.request.body.room
  const member_id = ctx.request.body.pk
  const changed_field = ctx.request.body.name
  const new_value = ctx.request.body.value
  const query = db.get('rooms')
    .find({ name: room_name })
    .get('members')
    .find({ id: member_id })
    .assign({ [changed_field]: new_value })
    .write()
  pusher.trigger('dungeon-events', 'table-edit', { room_name: room_name, member_id: member_id, changed_field: changed_field, new_value: new_value }, ctx.request.body.socket);
  ctx.response.body = member_id
  ctx.status = 200
}

async function edit_color(ctx) {
  const room_id = ctx.query.room_id
  const member_id = ctx.query.member_id
  const color = ctx.query.color
  const query = db.get('rooms')
    .find({ id: room_id })
    .get('members')
    .find({ id: member_id })
    .assign({ color: color })
    .write()
  pusher.trigger('dungeon-events', 'color-edit', { room_id: room_id, member_id: member_id, color: color }, ctx.query.socket);
  ctx.status = 200
}

async function edit_map(ctx) {
  const room_id = ctx.query.room_id
  const map_row = ctx.query.map_row
  const map_column = ctx.query.map_column
  const type = ctx.query.type
  const color = ctx.query.color
  const pog_label = ctx.query.pog_label
  const pog_size = ctx.query.pog_size
  const size_array = {
    "Tiny": "20px",
    "Small": "20px",
    "Medium": "20px",
    "Large": "44px",
    "Huge": "69px",
    "Gargantuan": "94px"
  }
  if (type == "map") {
    const cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      cells[cellIndex].color = color
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        color: color,
        pogs: []
      })
    }
    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (type === "participant") {
    const pog = {
      pog_id: color,
      pog_label: pog_label,
      pog_size: size_array[pog_size]
    }

    let cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    // Delete old pog
    cells.forEach(cell => {
      if (cell.pogs) {
        cell.pogs = cell.pogs.filter(pog => { return pog.pog_id !== color })
      }
    })

    // Add new pog
    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      if (cells[cellIndex].pogs) {
        cells[cellIndex].pogs.push(pog)
      } else {
        cells[cellsIndex].pogs = [pog]
      }
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        pogs: [pog]
      })
    }

    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (type === "delete_participant") {
    let cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    // Delete old pog
    cells.forEach(cell => {
      if (cell.pogs) {
        cell.pogs = cell.pogs.filter(pog => { return pog.pog_id !== color })
      }
    })

    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  }
  pusher.trigger('dungeon-events', 'map-edit', { room_id: room_id, map_row: map_row, map_column: map_column, type: type, color: color, pog_label: pog_label, pog_size: size_array[pog_size] });
  //	ctx.response.body = member_id
  ctx.status = 200
}

async function delete_member(ctx) {
  const room_id = ctx.query.room_id
  const member_id = ctx.query.member_id
  const member_query = db.get('rooms')
    .find({ id: room_id })
    .get('members')
    .remove({ id: member_id })
    .write()
  const pog_query = db.get('rooms')
    .find({ id: room_id })
    .get('map.pogs')
    .remove({ pog_id: member_id })
    .write()
  pusher.trigger('dungeon-events', 'table-delete', { room_id: room_id, member_id: member_id });
  ctx.status = 200
}

async function clear_map(ctx) {
  const room_id = ctx.query.room_id
  const mapcurrent = db.get('rooms')
    .find({ id: room_id })
    .assign({ 'cells': [] })
    .write()
  pusher.trigger('dungeon-events', 'map-clear', { room_id: room_id });
  ctx.status = 200
}

async function generate_monster(ctx) {
  const room_id = ctx.query.room_id
  const room_name = ctx.query.room_name
  const monster_name = ctx.query.monster_name
  const new_id = shortid.generate()
  var path = 'Monsters:' + monster_name + '.json';
  let target = await ctx.get(path, null, {
    'User-Agent': 'koa-http-request'
  });
  var hp_dice = target.data.HP.match(/\(([^)]+)\)/)[1];
  let hp_roll = diceRoller.roll(hp_dice).getTotal();
  var init_dice = "1d20+" + target.data["data-DEX-mod"];
  var init_roll = diceRoller.roll(init_dice).getTotal()
  var ac_roll = target.data.AC.substr(0, 2)
  var passive_perception = target.data["Passive Perception"]
  const proficiency_bonus_array = {
    "0": "+2",
    "1/8": "+2",
    "1/4": "+2",
    "1/2": "+2",
    "1": "+2",
    "2": "+2",
    "3": "+2",
    "3": "+2",
    "4": "+2",
    "5": "+3",
    "6": "+3",
    "7": "+3",
    "8": "+3",
    "9": "+4",
    "10": "+4",
    "11": "+4",
    "12": "+4",
    "13": "+5",
    "14": "+5",
    "15": "+5",
    "16": "+5",
    "17": "+6",
    "18": "+6",
    "19": "+6",
    "20": "+6",
    "21": "+7",
    "22": "+7",
    "23": "+7",
    "24": "+7",
    "25": "+8",
    "26": "+8",
    "27": "+8",
    "28": "+8",
    "29": "+9",
    "30": "+9"
  }
  var proficiency_bonus = proficiency_bonus_array[target.data["Challenge Rating"]]
  var proficiencies = ((typeof target.data.Skills !== "undefined") ? target.data.Languages + "; " + target.data.Skills : target.data.Languages)
  var push = {
    id: new_id,
    name: monster_name,
    init: init_roll,
    ac: ac_roll,
    hp: hp_roll,
    chp: hp_roll,
    notes: "",
    "stats-str": target.data.STR,
    "stats-dex": target.data.DEX,
    "stats-con": target.data.CON,
    "stats-int": target.data.INT,
    "stats-wis": target.data.WIS,
    "stats-cha": target.data.CHA,
    "stats-pp": passive_perception,
    "stats-xp": target.data["data-XP"],
    "stats-prof": proficiency_bonus,
    "stats-senses": target.data.Senses,
    "stats-proficiencies": proficiencies,
    "stats-speed": target.data.Speed,
    "stats-size": target.data.Size,
    "info": target.htmlcontent
  }
  const query = db.get('rooms')
    .find({ id: room_id })
    .get('members')
    .push(push)
    .write()
  pusher.trigger('dungeon-events', 'table-add', { room_name: room_name });
  //	ctx.response.body = new_id
  ctx.status = 200
}

async function download_map(ctx) {
  const room_name = ctx.query.room_name
  const room_id = ctx.query.room_id
  const now = moment().format("DD-MM-YY");
  const map = db.get("rooms")
    .find({ id: room_id })
    .get("map")
    .cloneDeep()
    .value();
  ctx.body = map;
  ctx.attachment(room_name + "_map_" + now + ".json");
}

async function download_participants(ctx) {
  const room_name = ctx.query.room_name
  const room_id = ctx.query.room_id
  const now = moment().format("DD-MM-YY");
  const participants = db.get("rooms")
    .find({ id: room_id })
    .get("members")
    .cloneDeep()
    .value();
  ctx.body = participants;
  ctx.attachment(room_name + "_participants_" + now + ".json");
}

async function import_participants(ctx) {

}

if (!module.parent) app.listen(3001);