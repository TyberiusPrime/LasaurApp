$(document).ready(function(){
  
  var raw_gcode = null;
  var raw_gcode_by_color = null;
  var path_optimize = 1;
  var forceSvgDpiTo = undefined;
  var minNumPassWidgets = 3;
  var maxNumPassWidgets = 32;
  var last_colors_used = [];
  
  // G-Code Canvas Preview
  var icanvas = new Canvas('#import_canvas');
  icanvas.width = 610;  // HACK: for some reason the canvas can't figure this out itself
  icanvas.height = 305; // HACK: for some reason the canvas can't figure this out itself
  icanvas.background('#ffffff'); 
  
  
  // file upload form
  $('#svg_upload_file').change(function(e){
    $('#svg_import_btn').button('loading');
    $('#svg_loading_hint').show();
    var input = $('#svg_upload_file').get(0)
    var browser_supports_file_api = true;
    if (typeof window.FileReader !== 'function') {
      browser_supports_file_api = false;
      $().uxmessage('notice', "This requires a modern browser with File API support.");
    } else if (!input.files) {
      browser_supports_file_api = false;
      $().uxmessage('notice', "This browser does not support the files property.");
    }
    
    if (browser_supports_file_api) {
      if (input.files[0]) {
        var fr = new FileReader()
        fr.onload = sendToBackend
        fr.readAsText(input.files[0])
      } else {
        $().uxmessage('error', "No file was selected.");
      }
    } else {  // fallback
      // $().uxmessage('notice', "Using fallback: file form upload.");
    }
    
    // reset file input form field so change event also triggers if
    // same file is chosen again (but with different dpi)
    $('#svg_upload_file_temp').val($('#svg_upload_file').val())
    $('#svg_upload_file').val('')

  	e.preventDefault();
  });


  function sendToBackend(e) {
    var filedata = e.target.result;
    var fullpath = $('#svg_upload_file_temp').val();
    var filename = fullpath.split('\\').pop().split('/').pop();
    var ext = filename.slice(-4);
    if (ext == '.svg' || ext == '.SVG') {
      $().uxmessage('notice', "parsing SVG ...");
    } else if (ext == '.dxf' || ext == '.DXF') {
      $().uxmessage('notice', "parsing DXF ...");
      $().uxmessage('warning', "DXF import is limited to R14, lines, arcs, lwpolylines, and mm units");
    }
    if (filedata.length > 102400) {
      $().uxmessage('notice', "Importing large files may take a few minutes.");
    }
    $.ajax({
      type: "POST",
      url: "/svg_reader",
      data: {'filename':filename,'filedata':filedata, 'dpi':forceSvgDpiTo, 'optimize':path_optimize},
      dataType: "json",
      success: function (data) {
        if (ext == '.svg' || ext == '.SVG') {
          $().uxmessage('success', "SVG parsed."); 
          $('#dpi_import_info').html('Using <b>' + data.dpi + 'dpi</b> for converting px units.');
        } else if (ext == '.dxf' || ext == '.DXF') {
          $().uxmessage('success', "DXF parsed."); 
          $('#dpi_import_info').html('Assuming mm units in DXF file.');
        } else {
          $().uxmessage('warning', "File extension not supported. Import DXF or SVG files."); 
        }
        // alert(JSON.stringify(data));
        handleParsedGeometry(data);
      },
      error: function (data) {
        $().uxmessage('error', "backend error.");
      },
      complete: function (data) {
        $('#svg_import_btn').button('reset');
        forceSvgDpiTo = undefined;  // reset
      }
    });
  }

  var last_data = '';
      
  function handleParsedGeometry(data) {
    // data is a dict with the following keys [boundarys, dpi, lasertags]
     last_data = data;
    var boundarys = data.boundarys;
    if (boundarys) {
      raw_gcode_by_color = {};
      for (var color in boundarys) {
        raw_gcode_by_color[color] = GcodeWriter.write(boundarys[color], 1.0, 0.0, 0.0);
      }
      // reset previous color toggles
      $('#canvas_properties .colorbtns').html('');  // reset colors
      $('#passes').html('');  // pass widgets
      // add color toggles to preview and pass widgets
      var color_order = {};  // need this to easily activate button from lasertags
      var color_count = 0;   // need this to default single color geos to pass1
      for (var color in raw_gcode_by_color) {     
        color_order[color] = color_count;
        color_count++;
      }

      // create some pass widgets
      addPasses(Math.min(color_count, maxNumPassWidgets), color_order); 

      // show info div
      $('#passes_info').show();

      // add preview color buttons, show info, register events
      for (var color in color_order) {
        $('#canvas_properties .colorbtns').append('<button class="preview_color active-strong active btn btn-small" style="margin:2px"><div style="width:10px; height:10px; background-color:'+color+'"><span style="display:none">'+color+'</span></div></button>');
      }
      $('#canvas_properties .colorbtns').append('<div style="margin-top:10px; color:#888888">These affect the preview only. (See below for controls)</div>');      
      $('button.preview_color').click(function(e){
        // toggling manually because automatic toggling 
        // would happen after generatPreview()
        if($(this).hasClass('active')) {
          $(this).removeClass('active');
          $(this).removeClass('active-strong');
        } else {
          $(this).addClass('active');         
          $(this).addClass('active-strong');          
        }
        generatePreview();
      });

      // default selections for pass widgets, lasertags handling
      if (data.lasertags) {
        // [(12, 2550, '', 100, '%', ':#fff000', ':#ababab', ':#ccc999', '', '', ''), ...]
        $().uxmessage('notice', "lasertags -> applying settings");
        var tags = data.lasertags;
        // alert(JSON.stringify(tags))
        for (var i=0; i<tags.length; i++) {
          var vals = tags[i];
          if (vals.length == 11) {
            var pass = vals[0];
            var feedrate = vals[1];
            var intensity = vals[3];
            if (typeof(pass) === 'number' && pass <= maxNumPassWidgets) {
              //make sure to have enough pass widgets
              var passes_to_create = pass - getNumPasses()
              if (passes_to_create >= 1) {
                addPasses(passes_to_create, color_order);
              }
              // feedrate
              if (feedrate != '' && typeof(feedrate) === 'number') {
                $('#passes > div:nth-child('+pass+') .feedrate').val(feedrate);
              }
              // intensity
              if (intensity != '' && typeof(intensity) === 'number') {
                $('#passes > div:nth-child('+pass+') .intensity').val(intensity);
              }
              // colors
              for (var ii=5; ii<vals.length; ii++) {
                var col = vals[ii];
                if (col in color_order) {
                  $('#passes > div:nth-child('+pass+') .colorbtns button:eq('+color_order[col]+')').addClass('active active-strong')
                }
              }
            } else {
              $().uxmessage('error', "invalid lasertag (pass number)");
            }
          } else {
            $().uxmessage('error', "invalid lasertag (num of args)");
          }
        }
      } else {
        // no lasertags, if only one color assign to pass1
        if (color_count == 1) {
          $('#passes > div:nth-child(1) .colorbtns').children('button').addClass('active')
          $().uxmessage('notice', "assigned to pass1");
        }
      }
      // actually redraw right now 
      generatePreview();      
    } else {
      $().uxmessage('notice', "No data loaded to write G-code.");
    }   
  }

  function getNumPasses() {
    return $('#passes').children().length;
  }

  function addPasses(num, colors) {
    last_colors_used = colors;
    var pass_num_offset = getNumPasses() + 1;
    var buttons = new Array();
    var colors_by_index = new Array();
    var material_to_use = $('#material_to_use').val();
    if (material_to_use != '') {
        var i = 0;
        for (var color in app_settings['materials'][material_to_use]) {
            if (color in colors) {
                colors_by_index.push(color);
            }
        }
        for (var color in colors) {
            if (colors_by_index.indexOf(color) == -1)
                colors_by_index.unshift(color);
        }
    }
    else {
        for (var color in colors) {
          colors_by_index.push(color);
        }
    }
    for (var i in colors_by_index) {
        var color = colors_by_index[i];
        buttons.push('<button class="select_color btn btn-small" style="margin:2px"><div style="width:10px; height:10px; background-color:'+color+'"><span style="display:none">'+color+'</span></div></button>');
    }

    for (var i=0; i<num; i++) {
      var passnum = pass_num_offset+i;
      var margintop = '';
      if (passnum != 1) {
        margintop = 'margin-top:6px;'
      }
      var color = colors_by_index[i];
      var buttons_here = buttons.slice(0);
      var speed = [];
      var intensity = [];
      var repeat = 1;
      if (material_to_use != '') {
          if (color in app_settings['materials'][material_to_use])
          {
              buttons_here[i] = buttons_here[i].replace('class="', 'class="active ');
              var pass_info = app_settings['materials'][material_to_use][color];
              if( Object.prototype.toString.call( pass_info[0] ) === '[object Array]' ) {
                  for (var index in pass_info)
                  {
                      speed.push(pass_info[index][0]);
                      intensity.push(pass_info[index][1]);
                  }
                  repeat = pass_info.length;
              }
              else { // just a single pass 
                  speed.push(app_settings['materials'][material_to_use][color][0]);
                  intensity.push(app_settings['materials'][material_to_use][color][1]);
              }
          } else {
              if ('' in app_settings['materials'][material_to_use]) {
                  speed.push(app_settings['materials'][material_to_use][''][0]);
                  intensity.push(app_settings['materials'][material_to_use][''][1]);
              } else {
                  speed.push(2000);
                  intensity.push(100);
              }
          }
      }
      else {
          speed.push(2000);
          intensity.push(100);
      }
      for (var t = 0; t < repeat; t++) {
          var html = '';
          html += '<div class="row well" style="margin:0px; '+margintop+' padding:4px; background-color:#eeeeee">' + 
                  '<div class="form-inline" style="margin-bottom:0px">' +
                    '<label>Pass '+ passnum +': </label>' +
                    '<div class="input-prepend" style="margin-left:6px">' +
                      '<span class="add-on" style="margin-right:-5px;">F</span>' +
                      '<input type="text" class="feedrate" value="' + speed[t] + '" title="feedrate 1-8000mm/min" style="width:32px" data-delay="500">' +
                    '</div>' +
                    '<div class="input-prepend" style="margin-left:6px">' +
                      '<span class="add-on" style="margin-right:-5px;">%</span>' +
                      '<input class="intensity" type="textfield" value="' + intensity[t] + '" title="intensity 0-100%" style="width:26px;" data-delay="500">' +
                    '</div>' +
                    '<span class="colorbtns" style="margin-left:6px">'+buttons_here.join("\n")+'</span>' +
                  '</div>' +
                '</div>';
      

          // $('#passes').append(html);
          var pass_elem = $(html).appendTo('#passes');
          // color pass widget toggles events registration
          pass_elem.find('.colorbtns button.select_color').click(function(e){
            // toggle manually to work the same as preview buttons
            // also need active-strong anyways
            if($(this).hasClass('active')) {
              $(this).removeClass('active');
              $(this).removeClass('active-strong');
            } else {
              $(this).addClass('active');
              $(this).addClass('active-strong');      
            }
          });
      }
    }
  }


  
  function generatePreview() {
    if (raw_gcode_by_color) {        
      var exclude_colors =  {};
      $('#canvas_properties .colorbtns button').each(function(index) {
        if (!($(this).hasClass('active'))) {
          // alert(JSON.stringify($(this).find('div i').text()));
          exclude_colors[$(this).find('div span').text()] = 1;
        }
      });
      
      icanvas.background('#ffffff');
      // var bbox_list = [];
      var scale = 0.5;
      for (var color in raw_gcode_by_color) {
        if (!(color in exclude_colors)) {
          GcodeReader.parse(raw_gcode_by_color[color], scale);
          GcodeReader.draw(icanvas, color);
          // bbox_list.push([GcodeReader.bbox[0],GcodeReader.bbox[1],GcodeReader.bbox[2],GcodeReader.bbox[3]]);
        }
      }
      // // combine all bounding boxes and report on log
      // var overall_bbox = [0,0,0,0];
      // for (var bbidx in bbox_list) {
      //   var bbox = bbox_list[bbidx];
      //   overall_bbox = bboxExpand(overall_bbox, bbox[0], bbox[1])
      //   overall_bbox = bboxExpand(overall_bbox, bbox[2], bbox[3])
      // }
      // var bbox_width = (overall_bbox[2] - overall_bbox[0]) / scale;
      // var bbox_height = (overall_bbox[3] - overall_bbox[1]) / scale;
      // $().uxmessage('notice', "The calculated bounding box is " 
      //   + bbox_width.toFixed(1) + 'x' + bbox_height.toFixed(1) + 'mm'
      //   + ' (' + (bbox_width/25.4).toFixed(1) + 'x' + (bbox_height/25.4).toFixed(1) + 'in).');      
    } else {
      $().uxmessage('notice', "No data loaded to generate preview.");
    }       
  }

  // function bboxExpand(bbox, x,y) {
  //   var bbox_new = [bbox[0],bbox[1],bbox[2],bbox[3]];
  //   if (x < bbox[0]) {bbox_new[0] = x;}
  //   else if (x > bbox[2]) {bbox_new[2] = x;}
  //   if (y < bbox[1]) {bbox_new[1] = y;}
  //   else if (y > bbox[3]) {bbox_new[3] = y;}
  //   return bbox_new;
  // }

  // forwarding file open click
  $('#svg_import_btn').click(function(e){
    path_optimize = 1;
    $('#svg_upload_file').trigger('click');
  });  
  $('#svg_import_72_btn').click(function(e){
    path_optimize = 1;
    forceSvgDpiTo = 72;
    $('#svg_upload_file').trigger('click');
    return false;
  });
  $('#svg_import_90_btn').click(function(e){
    path_optimize = 1;
    forceSvgDpiTo = 90;
    $('#svg_upload_file').trigger('click');
    return false;
  });
  $('#svg_import_96_btn').click(function(e){
    path_optimize = 1;
    forceSvgDpiTo = 96;
    $('#svg_upload_file').trigger('click');
    return false;
  });    
  $('#svg_import_nop_btn').click(function(e){
    path_optimize = 0;
    $('#svg_upload_file').trigger('click');
    return false;
  });  

    
  $('#import_feedrate_1').tooltip();
  $('#import_intensity_1').tooltip();
  $('#import_feedrate_2').tooltip();
  $('#import_intensity_2').tooltip();
  $('#import_feedrate_3').tooltip();
  $('#import_intensity_3').tooltip();
  
  // setting up add to queue button
  $("#import_to_queue").click(function(e) {   
    // assemble multiple passes
    var gcodeparts = ["G21\nG90\nM80\n"];
    var feedrate;
    var intensity;
    var colors = {};
    var any_assingments = false;

    //// passes
    $('#passes > div').each(function(index) {
      $(this).find('.colorbtns button').each(function(index) {
        if ($(this).hasClass('active')) {
          colors[$(this).find('div span').text()] = 1;
        }
      });
      if (Object.keys(colors).length > 0) { 
        any_assingments = true;
        feedrate = mapConstrainFeedrate($(this).find('.feedrate').val());
        intensity = mapConstrainIntesity($(this).find('.intensity').val());
        gcodeparts.push("S"+intensity+"\nG1 F"+feedrate+"\nG0 F"+app_settings.max_seek_speed+"\n");
        for (var color in raw_gcode_by_color) {
          if(color in colors) {
            gcodeparts.push(raw_gcode_by_color[color]);
          }
        }
      }
      colors = {};
    });

    if (any_assingments == true) {     
      gcodeparts.push("M81\nS0\nG00X0Y0F"+app_settings.max_seek_speed+"\n");
      var gcodestring = gcodeparts.join('');
      var fullpath = $('#svg_upload_file_temp').val();
      var filename = fullpath.split('\\').pop().split('/').pop();
      save_and_add_to_job_queue(filename, gcodestring);
      load_into_gcode_widget(gcodestring, filename);
      $('#tab_jobs_button').trigger('click');
      // $().uxmessage('notice', "file added to laser job queue");
    } else {
      $().uxmessage('warning', "nothing to cut -> please assign colors to passes");
    }
  	return false;
  });


  $("#add_pass_btn").click(function(e) {
    if (getNumPasses() < maxNumPassWidgets) {
      addPasses(1, last_colors_used);
    } else {
      $().uxmessage('error', "Max number of passes reached.");
    }
    return false;
  });  


  $('#material_to_use').change(function(e){
      if (last_data != '') {
        handleParsedGeometry(last_data);
      }
  });

});  // ready
