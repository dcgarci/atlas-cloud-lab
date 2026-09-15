from pywinauto import Desktop

janela = Desktop(backend="uia").window(
    title="Microsoft Excel"
)

janela.print_control_identifiers()
