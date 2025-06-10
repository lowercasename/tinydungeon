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

const adapter = new FileSync('data/db.json')
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
        let role = context.role ? context.role : 'player'
        let html = ''
        let tableWidth = 50
        let tableHeight = 30
        let gridSize = tableWidth * tableHeight
        for (var i = 0; i < gridSize; i++) {
          let row = Math.floor(i / tableWidth) + 1;
          let column = (i % tableWidth) + 1;
          let contextCell = context.find(cell => parseInt(cell.row) === row && parseInt(cell.column) === column)
          let pogHtml = '', textHtml = '';
          if (contextCell && contextCell.pogs) {
            function populatePogs() {
              contextCell.pogs.forEach(pog => {
                pogHtml += `<span class="pog" data-id="${pog.pog_id}" style="width: ${pog.pog_size}; height: ${pog.pog_size};">${pog.pog_label}</span>`
              })
            }
            switch (role) {
              case 'dm':
                populatePogs()
                break;
              case 'player':
                if (contextCell.fog)
                  break;
                populatePogs()
                break;
            }
          }
          if (contextCell && contextCell.text) {
            // switch (role) {
            //   case 'dm':
            textHtml = `<div class="cell__text">${contextCell.text}</div>`
            //   break;
            // case 'player':
            //   if (contextCell.fog)
            //     break;
            // textHtml = `<div class="cell__text">${contextCell.text}</div>`
            // break;
            // }
          }
          // function cellVisibility(cell) {
          //   if (role === "dm") {
          //     return (cell ? cell.color : 'white')
          //   } else if (role === "player") {
          //     if (cell) {
          //       if (cell.fog) {
          //         // This cell is covered in fog of war - show only that.
          //         return 'fog'
          //       } else if (!cell.override) {
          //         // This cell is not covered in fog of war, and its true contents are visible to players
          //         return cell.color
          //       } else {
          //         // This cell is not covered in fog of war, but its true contents are invisible to players
          //         // switch (cell.color) {
          //         //   case 'secret':
          //         //     return 'black'
          //         //   case 'pit':
          //         //     return 'white'
          //         //   case 'trap':
          //         //     return 'white'
          //         //   default:
          //         //     return 'white'
          //         // }
          //         return cell.color
          //       }
          //     } else {
          //       // This cell doesn't have any information
          //       return 'fog'
          //     }
          //   }
          // }
          html += `<div title="Row ${row}, column ${column}" class="grid__cell" data-row="${row}" data-column="${column}" data-color="${contextCell ? contextCell.color : 'white'}" data-fog="${contextCell ? contextCell.fog : 'true'}" data-override="${contextCell ? contextCell.override : 'false'}">
            ${pogHtml ? pogHtml : ''}
            ${textHtml}
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
  .post('/edit_cell_text', edit_map)
  .post('/edit_cell_visibility', edit_map)
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
  const role = ctx.query.role ? ctx.query.role : 'player'
  const fog = ctx.query.show_fog === "true" ? true : false
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
    room.cells.role = role
    await ctx.render('show', { room: room, is_dm: (role === "dm" ? true : false), show_fog: fog });
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
  const socketId = ctx.query.socketId
  const room_id = ctx.query.room_id
  const map_row = ctx.query.map_row
  const map_column = ctx.query.map_column
  const tool_type = ctx.query.tool_type
  const tool_value = ctx.query.tool_value
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
  let override = false;
  const visible_tools = [
    'black', 'white', 'corner-nw', 'corner-ne', 'corner-sw', 'corner-se',
    'door-n', 'door-e', 'door-s', 'door-w',
    'trapdoor-floor', 'trapdoor-ceiling',
    'stairs-n', 'stairs-e', 'stairs-s', 'stairs-w',
    'column', 'fountain', 'chest', 'statue', 'altar-v', 'altar-h',
    'terrain', 'rocks'
  ]
  if (tool_type === "map") {
    const cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    // Check if tool is visible to non-DMs
    if (!visible_tools.includes(tool_value)) {
      console.log(tool_value)
      console.log("Does not include")
      switch (tool_value) {
        case 'secret':
          override = 'black'
          break;
        case 'pit':
          override = 'white'
          break;
        case 'trap':
          override = 'white'
          break;
        default:
          override = 'black'
          break;
      }
    }

    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      cells[cellIndex].color = tool_value
      cells[cellIndex].override = override
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        color: tool_value,
        pogs: [],
        fog: true,
        override: override
      })
    }
    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (tool_type === "participant") {
    const pog = {
      pog_id: tool_value,
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
        cell.pogs = cell.pogs.filter(pog => { return pog.pog_id !== tool_value })
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
        pogs: [pog],
        fog: true,
        override: false
      })
    }

    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (tool_type === "delete_participant") {
    let cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    // Delete old pog
    cells.forEach(cell => {
      if (cell.pogs) {
        cell.pogs = cell.pogs.filter(pog => { return pog.pog_id !== tool_value })
      }
    })

    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (tool_type === "text") {
    const cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      cells[cellIndex].text = tool_value
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        text: tool_value,
        pogs: [],
        fog: true,
        override: false
      })
    }
    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (tool_type === "fog") {
    let fog_value = (tool_value === "add" ? true : false)
    console.log(fog_value)
    const cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      cells[cellIndex].fog = fog_value
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        pogs: [],
        fog: fog_value,
        override: false
      })
    }
    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  } else if (tool_type === "override") {
    let override_value = (tool_value === "visible" ? false : tool_value)
    const cells = db.get('rooms')
      .find({ id: room_id })
      .get('cells')
      .value()

    const cellIndex = cells.findIndex(cell => cell.row === map_row && cell.column === map_column)
    if (cellIndex > -1) {
      cells[cellIndex].override = override_value
    } else {
      cells.push({
        row: map_row,
        column: map_column,
        fog: true,
        override: override_value,
        pogs: []
      })
    }
    db.get('rooms')
      .find({ id: room_id })
      .assign({ cells })
      .write()
  }
  console.log(socketId)
  pusher.trigger('dungeon-events', 'map-edit', {
    pusher: true,
    room_id: room_id,
    map_row: map_row,
    map_column: map_column,
    tool_type: tool_type,
    tool_value: tool_value,
    pog_label: pog_label,
    pog_size_px: size_array[pog_size]
  }, socketId);
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
    .get("cells")
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