// <Octoprint Klipper Plugin>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

$(function () {
  function KlipperEditorViewModel(parameters) {
    var self = this;
    var editor = null;
    var editordialog = $("#klipper_editor");

    self.settings = parameters[0];
    self.klipperViewModel = parameters[1];

    self.CfgFilename = ko.observable("");
    self.CfgContent = ko.observable("");
    self.loadedConfig = "";
    self.CfgChangedExtern = false;

    self.header = OctoPrint.getRequestHeaders({
      "content-type": "application/json",
      "cache-control": "no-cache",
    });

    $(window).on('resize', function() {
      self.klipperViewModel.sleep(200).then(
        function () {
          self.setEditorDivSize();
        }
      );
    });

    self.onShown = function () {
      self.checkExternChange();
      editor.focus();
      self.setEditorDivSize();
    }

    self.close_selection = function (index) {
      switch (index) {
        case 0:
          editordialog.modal('hide');
          break;
        case 1:
          self.editorFocusDelay(1000);
          break;
        case 2:
          self.saveCfg({closing: true});
          break;
      }
    }

    self.closeEditor = function () {
      self.CfgContent(editor.getValue());
      if (self.loadedConfig != self.CfgContent()) {

        var opts = {
          title: gettext("Closing without saving"),
          message: gettext("Your file seems to have changed.")
            + "<br />"
            + gettext("Do you really want to close it?"),
          selections: [gettext("Close"), gettext("Do not close"), gettext("Save & Close")],
          maycancel: false,
          onselect: function (index) {
              if (index > -1) {
                  self.close_selection(index);
              }
          },
        };

          showSelectionDialog(opts);
      } else {
        editordialog.modal('hide');
      }
    }

    self.addStyleAttribute = function ($element, styleAttribute) {
      $element.attr('style', styleAttribute);
    }

    self.setEditorDivSize = function () {
      var klipper_modal_body= $('#klipper_editor .modal-body');
      var klipper_config= $('#plugin-klipper-config');

      var height = $(window).height() - $('#klipper_editor .modal-header').outerHeight() - $('#klipper_editor .modal-footer').outerHeight() - 118;
      self.addStyleAttribute(klipper_modal_body, 'height: ' + height + 'px !important;');
      klipper_config.css('height', height);
      if (editor) {
        editor.resize();
      }
    };

    self.process = function (config) {
      return new Promise(function (resolve) {
        self.loadedConfig = config.content;
        self.CfgFilename(config.file);
        self.CfgContent(config.content);

        if (editor) {
          editor.session.setValue(self.CfgContent());
          self.CfgChangedExtern = false;
          editor.setFontSize(self.settings.settings.plugins.klipper.configuration.fontsize());
          self.settings.settings.plugins.klipper.configuration.old_config(config.content);
          editor.clearSelection();
          self.klipperViewModel.sleep(500).then(
            function() {
              self.setEditorDivSize();
              resolve("done");
            }
          );
        }
      });
    }

    self.onDataUpdaterPluginMessage = function (plugin, data) {
      if (plugin == "klipper" && data.type == "reload" && data.subtype == "config") {
        self.klipperViewModel.consoleMessage("debug", "onDataUpdaterPluginMessage klipper reload baseconfig");
        self.ConfigChangedAfterSave();
      }
    };

    self.ConfigChangedAfterSave = function () {
      if (!self.klipperViewModel.hasRight("CONFIG")) return;

      if (self.CfgFilename() == self.settings.settings.plugins.klipper.configuration.baseconfig()) {
        self.CfgChangedExtern = true;
        self.checkExternChange();
      }
    };

    self.checkExternChange = function() {
      var baseconfig = self.settings.settings.plugins.klipper.configuration.baseconfig();
      if (self.CfgChangedExtern && self.CfgFilename() == baseconfig) {
        if (editordialog.is(":visible")) {

          var perform = function () {
            self.reloadFromFile();
          }

          var html = "<p>" + gettext("Reload Configfile after SAVE_CONFIG?") + "</p>";

          showConfirmationDialog({
            title: gettext("Externally changed config") + " " + baseconfig,
            html: html,
            proceed: gettext("Proceed"),
            onproceed: perform,
          });
        }
      }
    }

    self.checkSyntax = function () {
      if (editor.session) {
        self.klipperViewModel.consoleMessage("debug", "checkSyntax started");

        OctoPrint.plugins.klipper.checkCfg(editor.session.getValue())
          .done(function (response) {
            var msg = ""
            if (response.is_syntax_ok == true) {
              self.klipperViewModel.showPopUp("success", gettext("SyntaxCheck"), gettext("SyntaxCheck OK"));
              self.editorFocusDelay(1000);
            } else {
              msg = gettext('Syntax NOK')
              showMessageDialog(
                msg,
                {
                  title: gettext("SyntaxCheck"),
                  onclose: function () { self.editorFocusDelay(1000); }
                }
              );
            }
          });
      };
    };

    self.saveCfg = function (options) {
      var options = options || {};
      var closing = options.closing || false;

      if (editor.session) {
        self.klipperViewModel.consoleMessage("debug", "SaveCfg start");

        OctoPrint.plugins.klipper.saveCfg(editor.session.getValue(), self.CfgFilename())
          .done(function (response) {

            if (response.saved === true) {
              self.klipperViewModel.showPopUp("success", gettext("Save Config"), gettext("File saved."));
              self.loadedConfig = editor.session.getValue();
              if (closing) {
                editordialog.modal('hide');
              }
              if (self.settings.settings.plugins.klipper.configuration.restart_onsave()==true) {
                self.klipperViewModel.requestRestart();
              }
            } else {
              showMessageDialog(
                gettext('File not saved!'),
                {
                  title: gettext("Save Config"),
                  onclose: function () { self.editorFocusDelay(1000); }
                }
              )
            }
          });
      }
    };

    self.minusFontsize = function () {
      self.settings.settings.plugins.klipper.configuration.fontsize(
        self.settings.settings.plugins.klipper.configuration.fontsize() - 1
      );
      if (self.settings.settings.plugins.klipper.configuration.fontsize() < 9) {
        self.settings.settings.plugins.klipper.configuration.fontsize(9);
      }
      if (editor) {
        editor.setFontSize(
          self.settings.settings.plugins.klipper.configuration.fontsize()
        );
        editor.resize();
      }
    };

    self.plusFontsize = function () {
      self.settings.settings.plugins.klipper.configuration.fontsize(
        self.settings.settings.plugins.klipper.configuration.fontsize() + 1
      );
      if (self.settings.settings.plugins.klipper.configuration.fontsize() > 20) {
        self.settings.settings.plugins.klipper.configuration.fontsize(20);
      }
      if (editor) {
        editor.setFontSize(
          self.settings.settings.plugins.klipper.configuration.fontsize()
        );
        editor.resize();
      }
    };

    self.reloadFromFile = function () {
      OctoPrint.plugins.klipper.getCfg(self.CfgFilename())
        .done(function (response) {
          self.klipperViewModel.consoleMessage("debug", "reloadFromFile done");
          if (response.response.text != "") {
            var msg = response.response.text
            showMessageDialog(
              msg,
              {
                title: gettext("Reload File")
              }
            )
          } else {
            self.klipperViewModel.showPopUp("success", gettext("Reload Config"), gettext("File reloaded."));
            self.CfgChangedExtern = false;
            if (editor) {
              editor.session.setValue(response.response.config);
              self.loadedConfig = response.response.config;
              editor.clearSelection();
              editor.focus();
            }
          }
        })
        .fail(function (response) {
          var msg = response
          showMessageDialog(
            msg,
            {
              title: gettext("Reload File")
            }
          )
        });
    };


    self.onStartup = function () {
      ace.config.set("basePath", "plugin/klipper/static/js/lib/ace/");
      editor = ace.edit("plugin-klipper-config");
      editor.setTheme("ace/theme/monokai");
      editor.session.setMode("ace/mode/klipper_config");
      editor.clearSelection();

      editor.setOptions({
        hScrollBarAlwaysVisible: false,
        vScrollBarAlwaysVisible: false,
        autoScrollEditorIntoView: true,
        showPrintMargin: false,
        //maxLines: "Infinity"
      });

      editor.session.on('change', function (delta) {
        self.CfgContent(editor.getValue());
        editor.resize();
      });
    };

    self.editorFocusDelay = function (delay) {
      self.klipperViewModel.sleep(delay).then(
        function () {
          editor.focus();
        }
      );
    };
  }

  OCTOPRINT_VIEWMODELS.push({
    construct: KlipperEditorViewModel,
    dependencies: ["settingsViewModel", "klipperViewModel"],
    elements: ["#klipper_editor"],
  });
});
