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
    var obKlipperConfig = null;
    var editor = null;
    var editor_dirty = false;

    self.settings = parameters[0];
    self.klipperViewModel = parameters[1];

    self.CfgFilename = ko.observable("");
    self.CfgContent = ko.observable("");
    self.config = []

    self.header = OctoPrint.getRequestHeaders({
      "content-type": "application/json",
      "cache-control": "no-cache",
    });

    $('#klipper_editor').on('shown.bs.modal', function () {
      editor.focus();
      self.setEditorDivSize();
      $(window).on('resize', function(){
        self.klipperViewModel.sleep(500).then(
          function () {
            self.setEditorDivSize();
          }
        );
      });
    });

    self.closeEditor = function () {
      if (editor_dirty===true) {
        showConfirmationDialog({
          message: gettext(
              "Your file seems to have changed."
          ),
          question: gettext("Do you really want to close it?"),
          cancel: gettext("No"),
          proceed: gettext("Yes"),
          onproceed: function () {
            var dialog = $("#klipper_editor");
            dialog.modal('hide');
          },
          nofade: true
        });
      } else {
        var dialog = $("#klipper_editor");
        dialog.modal('hide');
      }
    }

    self.addStyleAttribute = function ($element, styleAttribute) {
      $element.attr('style', $element.attr('style') + '; ' + styleAttribute);
    }

    self.setEditorDivSize = function () {
      var klipper_modal_body= $('#klipper_editor .modal-body');
      var klipper_config= $('#plugin-klipper-config');

      var height = $(window).height() - $('#klipper_editor .modal-header').outerHeight() - $('#klipper_editor .modal-footer').outerHeight() - 118;
      self.addStyleAttribute(klipper_modal_body, 'height: ' + height + 'px !important;');
      //self.addStyleAttribute(klipper_config, 'height: ' + height + 'px !important;');
      klipper_config.css('height', height);
      if (editor) {
        editor.resize();
      }
    };

    self.process = function (config) {
      return new Promise(function (resolve) {
        self.config = config;
        self.CfgFilename(config.file);
        self.CfgContent(config.content);

        if (editor) {
          editor.session.setValue(self.CfgContent());
          editor_dirty=false;
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

    self.saveCfg = function () {
      if (editor.session) {
        self.klipperViewModel.consoleMessage("debug", "SaveCfg start");

        OctoPrint.plugins.klipper.saveCfg(editor.session.getValue(), self.CfgFilename())
          .done(function (response) {
            var msg = ""
            if (response.saved === true) {
              self.klipperViewModel.showPopUp("success", gettext("Save Config"), gettext("File saved."));
              editor_dirty = false;
              if (self.settings.settings.plugins.klipper.configuration.restart_onsave()==true) {
                self.klipperViewModel.requestRestart();
              }
            } else {
              msg = gettext('File not saved!')
              showMessageDialog(
                msg,
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

    self.loadLastSession = function () {
      if (self.settings.settings.plugins.klipper.configuration.old_config() != "") {
        self.klipperViewModel.consoleMessage(
          "info",
          "lastSession:" +
          self.settings.settings.plugins.klipper.configuration.old_config()
        );
        if (editor.session) {
          editor.session.setValue(
            self.settings.settings.plugins.klipper.configuration.old_config()
          );
          editor.clearSelection();
        }
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
            if (editor) {
              editor.session.setValue(response.response.config);
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
        editor_dirty = true;
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
