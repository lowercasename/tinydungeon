$(function () {

  const directions = [
    0,
    90,
    180,
    270
  ]
  const size_array = {
    "Tiny": "20px",
    "Small": "20px",
    "Medium": "20px",
    "Large": "44px",
    "Huge": "69px",
    "Gargantuan": "94px"
  }
  $('.grid__cell[data-color="rocks"]').each(function () {
    let direction = directions[Math.floor(Math.random() * directions.length)]
    $(this).css('transform', 'rotate(' + direction + 'deg)')
  })

  $(".color-picker").on('change.spectrum', function (e, tinycolor) {
    room_id = $('input#room_id').val();
    member_id = $(this).attr("data-id");
    color = $(this).val();
    console.log(member_id)
    $("input#" + member_id + " + .participant-color").css("background-color", color);
    $.post('/edit_color?' + $.param({ room_id: room_id, member_id: member_id, color: color }));
  });

  $("td[colspan=7]").find(".toggle-container").hide();
  //	$(".main-row:eq(1)").css("color", "red");
  $(".expand-toggle").click(function (event) {
    event.stopPropagation();
    target = $(this).closest("tr").next().find(".toggle-container");
    target.slideToggle("fast");
    if (target.height() > 1) {
      $(this).html('<span><i class="fas fa-plus-square"></i></span>')
    } else {
      $(this).html('<span><i class="fas fa-minus-square"></i></span>')
    }
    return false;
  });
  $('#monster_name').select2();
  $('form#add_member').submit(function (event) {
    event.preventDefault();
    room_name = $('input#room_name').val();
    room_id = $('input#room_id').val();
    name = $('input#name').val();
    init = $('input#init').val();
    ac = $('input#ac').val();
    hp = $('input#hp').val();
    if ($.trim(name).length && $.trim(init).length && $.trim(hp).length && $.trim(ac).length) {
      $.post('/add_member?' + $.param({ room: room_name, name: name, init: init, ac: ac, hp: hp }), function (data) {
        location.reload();
        //				member_id = data;
        //				const new_row = '<tr><td><a href="#" class="editable name" data-name="name" data-type="text" data-pk="'+member_id+'" data-url="/edit_member">'+name+'</a></td><td><a href="#" class="editable init" data-name="init" data-type="number" data-pk="'+member_id+'" data-url="/edit_member">'+init+'</a></td><td><a href="#" class="editable hp" data-name="hp" data-type="number" data-pk="'+member_id+'" data-url="/edit_member">'+hp+'</a></td><td><div class="hpbarborder"><div class="hpbar"><a href="#" class="editable chp" data-name="chp" data-type="number" data-pk="'+member_id+'" data-url="/edit_member">'+hp+'</a></div></div></td><td><a href="#" class="editable notes" data-name="notes" data-type="text" data-pk="'+member_id+'" data-url="/edit_member" data-text="Make a note"></a></td><td><div class="member-controls"><a class="delete-member" href="#" data-id="'+member_id+'" data-room="'+room_id+'"><i class="fas fa-skull"></i> Delete</a></div></td></tr>';
        //        $('table#members-list tbody').append(new_row);
        //				$('.name, .init, .hp, .chp').editable({
        //					clear: false
        //				});
        //				$('.notes').editable({
        //						placeholder: "Make a note",
        //						emptytext: "Make a note",
        //						clear: false
        //				});
        //        $('input#name, input#init, input#hp').val('');
      });
    }
  })
  $('form#generate_monster').submit(function (event) {
    event.preventDefault();
    monster_name = $('select#monster_name').val();
    //		monsters_number = $('select#monsters_number').val();
    room_id = $('input#room_id').val();
    room_name = $('input#room_name').val();
    $.post('/generate_monster?' + $.param({ room_id: room_id, room_name: room_name, monster_name: monster_name }), function () { location.reload() });
    //		while (monsters_number > 0) {
    //			if (monsters_number <= 1){
    //				$.post('/generate_monster?' + $.param({room_id:room_id, monster_name:monster_name}));
    //				monsters_number = monsters_number-1;
    //				console.log(monsters_number)
    //			}
    //			else {
    //				$.post('/generate_monster?' + $.param({room_id:room_id, monster_name:monster_name}), function(){ location.reload() });
    //				console.log("Last one!")
    //			}
    //		}
  })
  $("#members-list").on("click", ".delete-member", function (event) {
    event.preventDefault();
    if (confirm("Are you sure you want to delete this participant?")) {
      const member_id = $(this).attr("data-id")
      const room_id = $(this).attr("data-room")
      $.post('/delete_member?' + $.param({ room_id: room_id, member_id: member_id }), function () {
        $("tr." + member_id).remove();
        $(".pog[data-id='" + member_id + "']").remove();
        var label = $("input#" + member_id + " + .participant-color")
        $("input#" + member_id).remove();
        $(label).remove();
      });
    }
  })
  $("#random_monster").click(function () {
    const monster_list = $("#monster_name > option");
    const selected_monster = monster_list[Math.floor(Math.random() * monster_list.length)].value;
    monster_name = selected_monster;
    room_id = $('input#room_id').val();
    room_name = $('input#room_name').val();
    $.post('/generate_monster?' + $.param({ room_id: room_id, room_name: room_name, monster_name: monster_name }), function () { location.reload() });
  })
  $("#toggle-dice-documentation").click(function (e) {
    e.preventDefault()
    $("#dice-documentation").toggle();
    if ($('#dice-documentation').is(':visible')) {
      $(this).text('Click to hide documentation');
    } else {
      jQuery(this).text('Click to show documentation');
    }
  })
  $("#clear-map").click(function () {
    room_id = $('input#room_id').val();
    $.post('/clear_map?' + $.param({ room_id: room_id }), function () { location.reload() });
  })

  function assignPogColor(pog_id) {
    var color = $("input#" + pog_id + " + .participant-color").css("background-color");
    if (color == "rgba(0, 0, 0, 0)") {
      color = "#fff";
      $(".pog[data-id='" + pog_id + "']").css("border", "1px solid #ccc");
    }
    $(".pog[data-id='" + pog_id + "']").css("background-color", color);
  }

  function updateTable(room_name, member_id, changed_field, new_value) {
    if ($('input#room_name').val() == room_name) {
      $("." + changed_field + "[data-pk='" + member_id + "']").text(new_value).editable('setValue', new_value);
      if (changed_field == "chp" || changed_field == "hp") {
        $(".chp[data-pk='" + member_id + "']").parent().each(function (index) {
          const id = $(this).children("a").attr("data-pk");
          const total_hp = $(".hp[data-pk='" + id + "']").text();
          const current_hp = $(this).text();
          const hp_ratio = (current_hp / total_hp) * 100;
          if (hp_ratio < 33) {
            //								if (current_hp < 2){
            //										$(this).children().css('color', 'black');
            //								}
            $(this).css('background-color', 'red');
            $(this).css('border-color', '#ffa5a5');
          }
          else if (hp_ratio > 33 && hp_ratio <= 66) {
            $(this).css('background-color', 'orange');
            $(this).css('border-color', '#dcd8b6');
          }
          else {
            $(this).css('background-color', '#11a911'); //Green
            $(this).css('border-color', '#7bdc7b');
          }
          $(this).animate({ width: hp_ratio + "%" });
        });
      }
    }
  }

  function removeRow(room_id, member_id) {
    if ($('input#room_id').val() == room_id) {
      $("tr." + member_id).remove();
      $(".pog[data-id='" + member_id + "']").remove();
      var label = $("input#" + member_id + " + .participant-color")
      $("input#" + member_id).remove();
      $(label).remove();
    }
  }

  function addRow(room_name) {
    if ($('input#room_name').val() == room_name) {
      location.reload();
    }
  }

  function clearMap(room_id) {
    if ($('input#room_id').val() == room_id) {
      location.reload();
    }
  }

  function editColor(room_id, member_id, color) {
    if ($('input#room_id').val() == room_id) {
      $(".color-picker[data-id='" + member_id + "']").spectrum("set", color);
      $("input#" + member_id + " + .participant-color").css("background-color", color);
      assignPogColor(member_id)
    }
  }

  function editMap(room_id, map_row, map_column, type, color, pog_label, pog_color, pog_size) {
    if ($('input#room_id').val() == room_id) {
      let cell = $('.grid__cell[data-row="' + map_row + '"][data-column="' + map_column + '"]')
      if (type == "map") {
        cell.attr('data-color', color)
        if (color === "rocks") {
          let direction = directions[Math.floor(Math.random() * directions.length)]
          cell.css('transform', 'rotate(' + direction + 'deg)')
        }
      } else if (type == "participant") {
        $(".pog[data-id='" + color + "']").remove();
        cell.append("<span class='pog' data-id='" + color + "' style='background-color: " + pog_color + "; width: " + pog_size + "; height: " + pog_size + "'>" + pog_label + "</span>");
        assignPogColor(color)
      } else if (type === "delete_participant") {
        $(".pog[data-id='" + color + "']").remove();
      }
    }
  }



  channel.bind('table-edit', function (data) {
    updateTable(data.room_name, data.member_id, data.changed_field, data.new_value);
  });
  channel.bind('table-delete', function (data) {
    //			console.log(data);
    removeRow(data.room_id, data.member_id);
  });
  channel.bind('table-add', function (data) {
    addRow(data.room_name);
  });
  channel.bind('map-edit', function (data) {
    editMap(data.room_id, data.map_row, data.map_column, data.type, data.color, data.pog_label, data.pog_color, data.pog_size);
  });
  channel.bind('color-edit', function (data) {
    editColor(data.room_id, data.member_id, data.color);
  });
  channel.bind('map-clear', function (data) {
    clearMap(data.room_id);
  });
  $("form#roll-dice").submit(function (event) {
    event.preventDefault();
    var roller = new DiceRoller();
    var code = $('input#dice-code').val();
    var result = roller.roll(code);
    $("#dice-result").text(result);
  })
  $(".hpbar").each(function (index) {
    const id = $(this).children("a").attr("data-pk");
    const total_hp = $(".hp[data-pk='" + id + "']").text();
    const current_hp = $(this).text();
    const hp_ratio = (current_hp / total_hp) * 100;
    $(this).css("width", hp_ratio + "%")
    if (hp_ratio < 33) {
      //								if (current_hp < 2){
      //										$(this).children().css('color', 'black');
      //								}
      $(this).css('background-color', 'red');
      $(this).css('border-color', '#ffa5a5');
    }
    else if (hp_ratio > 33 && hp_ratio <= 66) {
      $(this).css('background-color', 'orange');
      $(this).css('border-color', '#dcd8b6');
    }
    else {
      $(this).css('background-color', '#11a911'); //Green
      $(this).css('border-color', '#7bdc7b');
    }
  });

  // Mapping

  const cell = $('.grid__cell');

  function changeCell(cell) {
    const room_id = $('input#room_id').val();
    const tool_type = $("input[name='tool']:checked").attr("data-tool-type");
    const tool = $("input[name='tool']:checked").attr("id");
    const map_row = cell.data("row")
    const map_column = cell.data("column")
    const pog_label = $("input[name='tool']:checked").siblings(".participant-color").text();
    const pog_color = $("input[name='tool']:checked").siblings(".participant-color").css("background-color");
    const pog_size = $("input[name='tool']:checked").attr("data-tool-size");
    const pog_size_px = size_array[pog_size]
    $.post('/edit_map?' + $.param({ room_id: room_id, map_row: map_row, map_column: map_column, type: tool_type, color: tool, pog_label: pog_label, pog_color: pog_color, pog_size: pog_size }));
    if (tool_type == "map") {
      cell.attr('data-color', tool);
      if (tool === "rocks") {
        let direction = directions[Math.floor(Math.random() * directions.length)]
        cell.css('transform', 'rotate(' + direction + 'deg)')
      }
    }
    else if (tool_type == "participant") {
      $(".pog[data-id='" + tool + "']").remove();
      cell.append("<span class='pog' data-id='" + tool + "' style='width: " + pog_size_px + "; height: " + pog_size_px + "'>" + pog_label + "</span>");
      assignPogColor(tool);
      $('#remove-pog').prop('disabled', false)
    }
  }

  cell.mousedown(function (e) {
    e.preventDefault()
    if (e.which === 1) {
      changeCell($(this))
      cell.mouseenter(function (e) {
        e.preventDefault()
        changeCell($(this))
      })
    }
  })
  $(document).mouseup(function () {
    cell.off('mouseenter')
  })

  hover_counter = 0
  cell.mouseover(function () {
    if (hover_counter < 1) {
      const checkedTool = $("input[name='tool']:checked")
      if (checkedTool.data('tool-type') === "map") {
        $(this).attr('style', '--before-background: url(' + checkedTool.siblings('img').attr('src') + ');');
      } else if (checkedTool.data('tool-type') === "participant") {
        const pog_label = checkedTool.siblings(".participant-color").text()
        const pog_color = checkedTool.siblings(".participant-color").css('background-color')
        const pog_size = checkedTool.attr("data-tool-size")
        const pog_size_px = size_array[pog_size]
        $(this).append("<span class='pog pog-preview' style='opacity: .25; background-color: " + pog_color + "; width: " + pog_size_px + "; height: " + pog_size_px + "'>" + pog_label + "</span>")
      }
      hover_counter++
    }
  })
  cell.mouseleave(function () {
    hover_counter = 0
    $(this).find('.pog-preview').remove()
    $(this).attr('style', '--before-background: "";');
  })

  $('body').on('change', "input[type='radio']", function () {
    const pog_id = $(this).attr("id")
    if ($(this).is(':checked') && $(this).data('tool-type') === 'participant' && $(".pog[data-id='" + pog_id + "']").length) {
      $('#remove-pog').prop('disabled', false)
    } else {
      $('#remove-pog').prop('disabled', true)
    }
  })

  $('#remove-pog').click(function () {
    const pog_id = $("input[data-tool-type='participant']:checked").attr("id")
    const pog_element = $(".pog[data-id='" + pog_id + "']")
    const map_row = pog_element.closest('.grid__cell').data('row')
    const map_column = pog_element.closest('.grid__cell').data('column')
    const room_id = $('input#room_id').val()
    $.post('/edit_map?' + $.param({ room_id: room_id, map_row: map_row, map_column: map_column, type: 'delete_participant', color: pog_id }));
    $(".pog[data-id='" + pog_id + "']").remove()
    $('#remove-pog').prop('disabled', true)
  })

  $(".main-row").each(function () {
    var id = $(this).attr('class').split(' ')[0];
    var p = $(this).attr('class').split(' ')[0];
    var color = $(this).find(".color-picker").attr("data-color");
    var label = $(this).find(".name").text().substr(0, 1);
    var size = $(".toggle-row." + id).find(".stats-size").text();
    $("#map-participant-controls").append("<label><input type='radio' id='" + p + "' name='tool' data-tool-type='participant' data-tool-size='" + size + "'/><div class='participant-color' style='background-color:" + color + "'>" + label + "</div></label>");
  });

  $(".pog").each(function () {
    assignPogColor($(this).attr("data-id"));
  })

})
