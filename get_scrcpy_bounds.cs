using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;

class Program {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, ref RECT lpRect);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);


    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    public struct POINT {
        public int X;
        public int Y;
    }

    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOACTIVATE = 0x0010;
    const int SW_HIDE = 0;
    const int SW_SHOW = 5;
    const int SW_RESTORE = 9;

    static void Main(string[] args) {
        // Find overlay window.
        IntPtr overlayHwnd = FindWindowByTitle("AeroScrcpyOverlayWindow");

        // Handle Pin/Unpin/Set-Pos/Hide/Show if requested via arguments
        if (args.Length > 0) {
            // Find scrcpy window for one-shot commands
            IntPtr scrcpyHwndOne = FindWindowByTitle("DeviceMirrorSession");
            if (scrcpyHwndOne == IntPtr.Zero) {
                Environment.Exit(1);
            }

            if (args[0] == "--pin") {
                SetWindowPos(scrcpyHwndOne, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Pinned");
                return;
            } else if (args[0] == "--unpin") {
                SetWindowPos(scrcpyHwndOne, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Unpinned");
                return;
            } else if (args[0] == "--set-pos" && args.Length >= 3) {
                int x = int.Parse(args[1]);
                int y = int.Parse(args[2]);
                if (y < 0) y = 0; // Force title bar to remain on screen
                SetWindowPos(scrcpyHwndOne, IntPtr.Zero, x, y, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Positioned to " + x + ", " + y);
                return;
            } else if (args[0] == "--hide") {
                ShowWindow(scrcpyHwndOne, SW_HIDE);
                Console.WriteLine("Hidden");
                return;
            } else if (args[0] == "--show") {
                ShowWindow(scrcpyHwndOne, SW_SHOW);
                ShowWindow(scrcpyHwndOne, SW_RESTORE);
                SetWindowPos(scrcpyHwndOne, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Shown");
                return;
            }
        }

        // Persistent tracking loop
        while (true) {
            Process[] procs = Process.GetProcessesByName("scrcpy");
            IntPtr scrcpyHwnd = IntPtr.Zero;
            foreach (var p in procs) {
                if (p.MainWindowHandle != IntPtr.Zero) {
                    scrcpyHwnd = p.MainWindowHandle;
                    break;
                }
            }

            if (scrcpyHwnd != IntPtr.Zero) {
                RECT rect = new RECT();
                if (GetWindowRect(scrcpyHwnd, ref rect)) {
                    IntPtr fg = GetForegroundWindow();
                    int isFg = 0;
                    if (fg == scrcpyHwnd || (overlayHwnd != IntPtr.Zero && fg == overlayHwnd)) {
                        isFg = 1;
                    }
                    if (IsIconic(scrcpyHwnd)) {
                        isFg = 0;
                    }
                    int isMouseOver = 0;
                    POINT pt;
                    if (GetCursorPos(out pt)) {
                        if (pt.X >= rect.Left && pt.X <= rect.Right && pt.Y >= rect.Top && pt.Y <= rect.Bottom) {
                            isMouseOver = 1;
                        }
                    }
                    Console.WriteLine("{0} {1} {2} {3} {4} {5}", rect.Left, rect.Top, rect.Right, rect.Bottom, isFg, isMouseOver);
                } else {
                    Console.WriteLine("NOT_FOUND");
                }
            } else {
                Console.WriteLine("NOT_FOUND");
            }

            System.Threading.Thread.Sleep(250);
        }
    }

    // Helper to find window by title
    [DllImport("user32.dll", EntryPoint = "EnumWindows", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    static IntPtr FindWindowByTitle(string title) {
        IntPtr foundHwnd = IntPtr.Zero;
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, sb.Capacity);
            if (sb.ToString() == title) {
                foundHwnd = hWnd;
                return false; // stop enumeration
            }
            return true;
        }, IntPtr.Zero);
        return foundHwnd;
    }
}
