import win32gui
import win32process
import win32com.client

def proc_cmd(pid):
    try:
        wmi = win32com.client.GetObject("winmgmts:\\\\.\\root\\cimv2")
        items = wmi.ExecQuery(
            f"SELECT ProcessId,CommandLine FROM Win32_Process WHERE ProcessId={pid}"
        )
        for p in items:
            return str(p.CommandLine or "")
    except:
        pass
    return ""

def enum_windows(hwnd, _):
    try:
        if not win32gui.IsWindowVisible(hwnd):
            return True

        title = win32gui.GetWindowText(hwnd)
        cls = win32gui.GetClassName(hwnd)

        if cls == "NUIDialog" and title == "Microsoft Excel":
            _, pid = win32process.GetWindowThreadProcessId(hwnd)

            print("POPUP HWND :", hwnd)
            print("POPUP PID  :", pid)
            print("COMMAND    :", proc_cmd(pid))
            print()

    except:
        pass

    return True

win32gui.EnumWindows(enum_windows, None)

print("=== EXCEL ATIVOS ===")

wmi = win32com.client.GetObject("winmgmts:\\\\.\\root\\cimv2")

for p in wmi.ExecQuery(
    "SELECT ProcessId,CommandLine FROM Win32_Process WHERE Name='EXCEL.EXE'"
):
    print("PID:", p.ProcessId)
    print("CMD:", p.CommandLine)
    print()
