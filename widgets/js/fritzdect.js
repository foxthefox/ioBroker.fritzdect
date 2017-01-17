/*
    ioBroker.fritzdect Widget-Set
    version: "0.0.1"
    Copyright foxthefox 
    adapted from iobroker.metro

*/

"use strict";



// add translations for edit mode

if (vis.editMode) {

    $.extend(systemDictionary, {
        "oid-temp":         {"en": "temperature", "de": "Temperatur"},
        "oid-power":    {"en": "power",  "de": "Leistung"},
        "oid-energy":          {"en": "energy",    "de": "Energie"}
    });
}
    $.extend(true, systemDictionary, {
        "Leistung":          {"en": "power",      "de": "Leistung"},
        "Energie":          {"en": "energy",      "de": "Energie"},
        "Temp.":            { "en": "temp",      "de": "Temp."}
    });

vis.binds.fritzdectui = {

    version: "0.0.1",

    showVersion: function() {

        if (vis.binds.fritzdectui.version) {

            console.log('fritzdect widget version: ' + vis.binds.fritzdectui.version);

            vis.binds.fritzdectui.version = null;

        }

    },


    tileDialogFritz: function (el, wid, level_id, power_id, energy_id, temp_id, options, sliderOptions) {
        var $this = $(el).parent().find('.tile');

        var width  = parseInt(options.width, 10);
        var height = parseInt(options.height, 10);

        if (isNaN(width))  width  = undefined;
        if (isNaN(height)) height = undefined;
        
        level_id    = level_id   || '';
        power_id    = power_id || '';
        energy_id   = energy_id || '';
        temp_id     = temp_id || '';


        sliderOptions.min = (sliderOptions.min === undefined || sliderOptions.min === null || sliderOptions.min === '') ? 0.00 : parseFloat(sliderOptions.min);
        sliderOptions.max = (sliderOptions.max === undefined || sliderOptions.min === null || sliderOptions.max === '') ? 1.00 : parseFloat(sliderOptions.max);


        $(el).parent().on('click touchstart', function () {
            // Protect against two events
            if (vis.detectBounce(this)) return;

            $.metroDialog({
                width:     width,
                height:    height,
                overlay:   options.overlay   || false,
                shadow:    options.shadow    || false,
                flat:      options.flat      || false,
                draggable: options.draggable || false,
                icon:      options.icon  ? '<img src="' + options.icon + '">' : (options.icon_class ? '<span class="' + options.icon_class + '"></span>' : false),
                title:     options.title     || '',
                content:   '',
                onShow:    function(_dialog){
                    var content = _dialog.children('.content');
                    var html = '<div style="margin: 24px 0 0 24px;">';
                    html += '<div class="input-control switch"><label>';
                    html += '<input type="checkbox" name="' + wid + '_checkbox" id="' + wid + '_checkbox" data-oid="' + level_id + '"/>';
                    html += '<span class="check"></span>';
                    html += '</label></div>';
                    html += '</div><div style="margin: 12px 12px 0 12px;">';
                    html += '<table style="margin-top: 1px; margin-left: 12px; font-size:14px;display:inline-block;">' +
                            (power_id   ? ('<tr><td>' + (options.label_set   || ('Leistung')) + ':</td><td><span class="metro-dialog-string" data-oid="' + power_id   + '">' + power_id  + '</span>W</td></tr>') : '') +
                            (energy_id  ? ('<tr><td>' + (options.label_temp  || _('Energie'))   + ':</td><td><span class="metro-dialog-string" data-oid="' + energy_id  + '">' + energy_id + '</span>Wh</td></tr>') : '') +
                            (temp_id ? ('<tr><td>' + (options.label_drive || _('Temp.')) + ':</td><td><span class="metro-dialog-string" data-oid="' + temp_id + '">' + temp_id+ '</span>°C</td></tr>')  : '') +
                            '</table>';
                    content.html(html);

                    vis.binds.basic.checkbox(document.getElementById(wid + '_checkbox'), true, sliderOptions.min, sliderOptions.max); //warum galt slideroption für beides?
                }
            });
        });
      }
    };

vis.binds.fritzdectui.showVersion();
