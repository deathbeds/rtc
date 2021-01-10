
import json
import os.path as osp

from ._version import __version__

HERE = osp.abspath(osp.dirname(__file__))

with open(osp.join(HERE, 'labextension', 'package.json')) as fid:
    data = json.load(fid)

def _jupyter_labextension_paths():
    return [{
        'src': 'labextension',
        'dest': data['name']
    }]

from .app import JupyterRTCServer


def _jupyter_server_extension_paths():
    return [{
        "module": "jupyter_rtc.app",
        "app": JupyterRTCServer
    }]
