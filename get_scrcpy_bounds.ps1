# get_scrcpy_bounds.ps1
# Returns: "Left Top Right Bottom isForeground" for scrcpy window, or exits with code 1
$ErrorActionPreference = 'SilentlyContinue'
$proc = Get-Process -Name 'scrcpy' |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
        Select-Object -First 1

if (-not $proc) { exit 1 }

$TypeDef = @'
using System;
using System.Runtime.InteropServices;
public class WinHelper {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, ref RECT lpRect);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
'@

try { Add-Type -TypeDefinition $TypeDef -ErrorAction Stop } catch {}

$rect = New-Object WinHelper+RECT
[WinHelper]::GetWindowRect([IntPtr]$proc.MainWindowHandle, [ref]$rect) | Out-Null
$fg = [WinHelper]::GetForegroundWindow()
$isFg = ($fg -eq $proc.MainWindowHandle) ? "1" : "0"
Write-Output "$($rect.Left) $($rect.Top) $($rect.Right) $($rect.Bottom) $isFg"
