def task_jupyter_server_config():
    def make_config():
        import pathlib, json
        p = pathlib.Path("automerge/jupyter_server_config.json")
        d = json.loads(p.read_text())
        d["ServerApp"]["allow_origin"] = "*"
        pathlib.Path("jupyter_server_config.py").write_text(
            json.dumps(d)
        )

    return dict(actions=[make_config])
