$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut("D:\Data\Du Lieu D\Shortcut\AeroScrcpy.lnk")
$shortcut.TargetPath = "D:\AT\Phone\wireless-phone-remote-control-Wpr-scrcpy\dist\WprScrcpy-win32-x64\WprScrcpy.exe"
$shortcut.Arguments = ""
$shortcut.WorkingDirectory = "D:\AT\Phone\wireless-phone-remote-control-Wpr-scrcpy\dist\WprScrcpy-win32-x64"
$shortcut.IconLocation = "D:\AT\Phone\wireless-phone-remote-control-Wpr-scrcpy\dist\WprScrcpy-win32-x64\WprScrcpy.exe,0"
$shortcut.Description = "WprScrcpy"
$shortcut.Save()
