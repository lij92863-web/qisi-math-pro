Set shell = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = root
status = shell.Run("cmd.exe /d /c open-app.cmd /quiet", 0, True)
Select Case status
    Case 0
        WScript.Quit 0
    Case 3
        reason = "Port 3000 is in use. Stop the older Qisi service or close the program using that port and try again."
    Case 4
        reason = "The server file is missing. Check that the complete Qisi folder is in place."
    Case 5
        reason = "Node.js could not be found. Install Node.js LTS and try again."
    Case 6
        reason = "The browser for this Qisi question bank could not be opened. Check that it is installed."
    Case Else
        reason = "The local service did not start. Check the logs in " & root & "\tmp."
End Select
MsgBox reason, vbExclamation, "Qisi Math Pro"
WScript.Quit status
