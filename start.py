#!/usr/bin/env python3
"""启动仅本机可访问的页面服务，并打开默认浏览器。"""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def open_browser(url):
    """自动打开失败时，保留服务并提示手动访问地址。"""
    try:
        opened = webbrowser.open(url, new=2)
    except webbrowser.Error:
        opened = False
    if not opened:
        print("未能自动打开浏览器，请手动访问：" + url, flush=True)


def main():
    """从脚本所在目录提供静态文件，不依赖终端当前目录。"""
    parser = argparse.ArgumentParser(description="反派偏好选择器本地启动器", add_help=False)
    parser.add_argument("-h", "--help", action="help", help="显示启动说明")
    parser.add_argument("--port", type=int, default=8765, help="本地端口，默认 8765；0 表示临时端口")
    parser.add_argument("--no-browser", action="store_true", help="仅启动服务，不自动打开浏览器")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("端口必须在 0 到 65535 之间")

    directory = Path(__file__).resolve().parent
    required = ("index.html", "style.css", "data.js", "engine.js", "export.js", "app.js")
    missing = [name for name in required if not (directory / name).is_file()]
    if missing:
        print("项目文件缺失，请完整解压 ZIP：" + "、".join(missing), flush=True)
        return 1
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        print("无法启动本地服务：" + str(error), flush=True)
        print("端口可能已被占用。请确认是否已启动本项目，或使用 --port 8766 指定其他端口。", flush=True)
        return 1

    url = "http://127.0.0.1:{}/".format(server.server_port)
    print("反派偏好选择器已启动", flush=True)
    print("访问地址：" + url, flush=True)
    print("请保持此终端运行；按 Ctrl+C 停止服务。", flush=True)
    print("再次使用请保持相同浏览器和端口，以恢复原来的进度。", flush=True)
    opener = None
    if not args.no_browser:
        opener = threading.Timer(0.3, open_browser, args=(url,))
        opener.daemon = True
        opener.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。已保存的浏览器进度不会被清空。", flush=True)
    finally:
        if opener:
            opener.cancel()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
