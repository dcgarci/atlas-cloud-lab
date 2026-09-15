import win32gui

def enum_windows(hwnd, _):
    try:
        if not win32gui.IsWindowVisible(hwnd):
            return True

        if win32gui.GetClassName(hwnd) != "#32770":
            return True

        print("\n=== DIALOGO ===")
        print("HWND :", hwnd)
        print("TITULO:", repr(win32gui.GetWindowText(hwnd)))

        def enum_children(child, __):
            try:
                texto = win32gui.GetWindowText(child)
                classe = win32gui.GetClassName(child)

                if texto:
                    print(
                        "CHILD:",
                        child,
                        "| CLASS:",
                        classe,
                        "| TEXT:",
                        repr(texto),
                    )
            except Exception:
                pass

            return True

        win32gui.EnumChildWindows(hwnd, enum_children, None)

    except Exception as e:
        print("ERRO:", e)

    return True

win32gui.EnumWindows(enum_windows, None)
