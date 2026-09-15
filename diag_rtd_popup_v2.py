import win32gui

def enum_windows(hwnd, _):
    try:
        if not win32gui.IsWindowVisible(hwnd):
            return True

        title = win32gui.GetWindowText(hwnd)
        cls = win32gui.GetClassName(hwnd)

        texts = []

        def enum_children(child, __):
            try:
                txt = win32gui.GetWindowText(child)
                if txt:
                    texts.append(
                        (
                            child,
                            win32gui.GetClassName(child),
                            txt
                        )
                    )
            except:
                pass
            return True

        win32gui.EnumChildWindows(hwnd, enum_children, None)

        combined = (
            title + " " +
            " ".join(x[2] for x in texts)
        ).lower()

        if (
            "rtd" in combined
            or "servidor de dados" in combined
            or "respondendo" in combined
            or "microsoft excel" in combined
        ):
            print("\n============================")
            print("HWND :", hwnd)
            print("CLASS:", repr(cls))
            print("TITLE:", repr(title))

            for child, childcls, text in texts:
                print(
                    "CHILD:",
                    child,
                    "| CLASS:",
                    repr(childcls),
                    "| TEXT:",
                    repr(text)
                )

    except Exception as e:
        print("ERRO:", e)

    return True

win32gui.EnumWindows(enum_windows, None)
