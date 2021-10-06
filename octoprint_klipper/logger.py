from . import util

def log_info(self, message):
    self._octoklipper_logger.info(message)
    util.send_message(
        self,
        type = "log",
        subtype = "info",
        title = message,
        payload = message
    )

def log_debug(self, message):
    self._octoklipper_logger.debug(message)
    self._logger.info(message)
    util.send_message(
        self,
        type = "console",
        subtype = "debug",
        title = message,
        payload = message
    )

def log_error(self, error):
    self._octoklipper_logger.error(error)
    self._logger.error(error)
    util.send_message(
        self,
        type = "log",
        subtype = "error",
        title = error,
        payload = error
    )
