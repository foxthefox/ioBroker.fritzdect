/*
	ioBroker.vis fritzdect metro Widget-Set

	version: "0.0.2"

	based on iobroker.metro
	extended for fritzdect

	Copyright 2018-2021 foxthefox foxthefox@wysiwis.net
*/
'use strict';

// add translations for edit mode
$.extend(true, systemDictionary, {
	// Add your translations here, e.g.:
	// "size": {
	// 	"en": "Size",
	// 	"de": "Größe",
	// 	"ru": "Размер",
	// 	"pt": "Tamanho",
	// 	"nl": "Grootte",
	// 	"fr": "Taille",
	// 	"it": "Dimensione",
	// 	"es": "Talla",
	// 	"pl": "Rozmiar",
	// 	"zh-cn": "尺寸"
	// }

	oid: { en: 'switch', de: 'Schalter' },
	'oid-temp': { en: 'temperature', de: 'Temperatur' },
	'oid-power': { en: 'power', de: 'Leistung' },
	'oid-energy': { en: 'energy', de: 'Energie' },
	label_power: { en: 'label power', de: 'Label Leistung' },
	label_temp: { en: 'label temp', de: 'Label Temp.' },
	label_energy: { en: 'label energy', de: 'Label Energie' },
	Leistung: { en: 'power', de: 'Leistung' },
	Energie: { en: 'energy', de: 'Energie' },
	'Temp.': { en: 'temp', de: 'Temp.' }
});

// this code can be placed directly in fritzdect.html
vis.binds['fritzdect'] = {
	version: '0.0.2',
	showVersion: function() {
		if (vis.binds['fritzdect'].version) {
			console.log('Version fritzdect: ' + vis.binds['fritzdect'].version);
			vis.binds['fritzdect'].version = null;
		}
	},
	tileDialogFritz: function(el, wid, switch_id, power_id, energy_id, temp_id, options, switchOptions) {
		const $this = $(el).parent().find('.tile');

		let width = parseInt(options.width, 10);
		let height = parseInt(options.height, 10);

		if (isNaN(width)) width = undefined;
		if (isNaN(height)) height = undefined;

		switch_id = switch_id || '';
		power_id = power_id || '';
		energy_id = energy_id || '';
		temp_id = temp_id || '';

		switchOptions.off =
			switchOptions.off === undefined || switchOptions.off === null || switchOptions.off === '' ? 0 : 0;
		switchOptions.on =
			switchOptions.on === undefined || switchOptions.off === null || switchOptions.on === '' ? 1 : 1;

		$(el).parent().on('click touchstart', function() {
			// Protect against two events
			if (vis.detectBounce(this)) return;

			$.metroDialog({
				width: width,
				height: height,
				overlay: options.overlay || false,
				shadow: options.shadow || false,
				flat: options.flat || false,
				draggable: options.draggable || false,
				icon: options.icon
					? '<img src="' + options.icon + '">'
					: options.icon_class ? '<span class="' + options.icon_class + '"></span>' : false,
				title: options.title || '',
				content: '',
				onShow: function(_dialog) {
					let val_power_id = vis.states.attr(power_id + '.val');
					if (val_power_id === undefined || val_power_id === null || val_power_id === '') {
						val_power_id = '';
					} else {
						val_power_id = val_power_id.toFixed(1);
					}

					let val_temp_id = vis.states.attr(temp_id + '.val');
					if (val_temp_id === undefined || val_temp_id === null || val_temp_id === '') {
						val_temp_id = '';
					} else {
						val_temp_id = val_temp_id.toFixed(1);
					}

					let val_energy_id = vis.states.attr(energy_id + '.val');
					if (val_energy_id === undefined || val_energy_id === null || val_energy_id === '') {
						val_energy_id = '';
					} else {
						val_energy_id = parseFloat(val_energy_id).toFixed(0); //some weird toFixed() is not a function
					}

					const content = _dialog.children('.content');
					let html = '<div style="margin: 24px 0 0 24px;">';
					html += '<div class="input-control switch"><label>';
					html +=
						'<input type="checkbox" name="' +
						wid +
						'_checkbox" id="' +
						wid +
						'_checkbox" data-oid="' +
						switch_id +
						'"/>';
					html += '<span class="check"></span>';
					html += '</label></div>';
					html += '</div><div style="margin: 12px 12px 0 12px;">';
					html +=
						'<table style="margin-top: 1px; margin-left: 12px; font-size:14px;display:inline-block;">' +
						(power_id
							? '<tr><td>' +
								(options.label_power || _('Leistung')) +
								':</td><td><span class="metro-dialog-string" data-oid="' +
								power_id +
								'">' +
								val_power_id +
								'</span>W</td></tr>'
							: '') +
						(energy_id
							? '<tr><td>' +
								(options.label_energy || _('Energie')) +
								':</td><td><span class="metro-dialog-string" data-oid="' +
								energy_id +
								'">' +
								val_energy_id +
								'</span>Wh</td></tr>'
							: '') +
						(temp_id
							? '<tr><td>' +
								(options.label_temp || _('Temp.')) +
								':</td><td><span class="metro-dialog-string" data-oid="' +
								temp_id +
								'">' +
								val_temp_id +
								'</span>°C</td></tr>'
							: '') +
						'</table>';
					content.html(html);

					vis.binds.basic.checkbox(
						document.getElementById(wid + '_checkbox'),
						true,
						switchOptions.off,
						switchOptions.on
					);
				}
			});
		});
	}
};

vis.binds['fritzdect'].showVersion();
