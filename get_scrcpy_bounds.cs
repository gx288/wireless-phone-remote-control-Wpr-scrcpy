using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;

class Program {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, ref RECT lpRect);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

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

    static void Main(string[] args) {
        // Find scrcpy window.
        Process[] procs = Process.GetProcessesByName("scrcpy");
        IntPtr scrcpyHwnd = IntPtr.Zero;
        foreach (var p in procs) {
            if (p.MainWindowHandle != IntPtr.Zero) {
                scrcpyHwnd = p.MainWindowHandle;
                break;
            }
        }

        if (scrcpyHwnd == IntPtr.Zero) {
            Environment.Exit(1);
        }

        // Find overlay window.
        IntPtr overlayHwnd = FindWindowByTitle("AeroScrcpyOverlayWindow");

        // Handle Pin/Unpin if requested via arguments
        if (args.Length > 0) {
            if (args[0] == "--pin") {
                SetWindowPos(scrcpyHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Pinned");
                return;
            } else if (args[0] == "--unpin") {
                SetWindowPos(scrcpyHwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Console.WriteLine("Unpinned");
                return;
            }
        }

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
            Console.WriteLine("{0} {1} {2} {3} {4}", rect.Left, rect.Top, rect.Right, rect.Bottom, isFg);
        } else {
            Environment.Exit(1);
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
