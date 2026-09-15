import win32gui
from pywinauto import Desktop

hwnd_rtd = None

def enum_windows(hwnd, _):
    global hwnd_rtd

    if (
        win32gui.IsWindowVisible(hwnd)
        and win32gui.GetClassName(hwnd) == "NUIDialog"
        and win32gui.GetWindowText(hwnd) == "Microsoft Excel"
    ):
        hwnd_rtd = hwnd
        return False

    return True

win32gui.EnumWindows(enum_windows, None)

print("HWND_RTD =", hwnd_rtd)

if hwnd_rtd:
    janela = Desktop(backend="uia").window(handle=hwnd_rtd)
    janela.print_control_identifiers(depth=10)
