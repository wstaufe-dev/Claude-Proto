Attribute VB_Name = "ProtoTools"
' Claude-Proto Excel tools. The source of truth for this module is
' tools/excel/ProtoTools.bas in the repository; re-import it after changes.
'
'   ExportMathConfig      saves the workbook, then writes math\proto_v2.config.json
'   ImportSimResults      loads reports\sim-latest.txt into the "Sim Results" tab
'   ImportSimResultsFile  same, from a report file you pick
'   InstallToolButtons    (one time) creates the "Tools" tab with buttons
Option Explicit

Private Const RESULTS_SHEET As String = "Sim Results"
Private Const TOOLS_SHEET As String = "Tools"
Private Const CONFIG_OUT As String = "math\proto_v2.config.json"
Private Const LATEST_REPORT As String = "reports\sim-latest.txt"

' ---------- Export ----------

Public Sub ExportMathConfig()
    Dim root As String, wbPath As String, logPath As String, cmd As String, code As Long
    root = RepoRoot()
    If root = "" Then Exit Sub
    wbPath = LocalPath(ThisWorkbook.FullName)

    Application.StatusBar = "Saving workbook..."
    ThisWorkbook.Save

    logPath = Environ$("TEMP") & "\claude-proto-export.log"
    cmd = "cmd /c """ & "cd /d """ & root & """ && npm run export-config -- """ & wbPath & """ """ & CONFIG_OUT & _
          """ > """ & logPath & """ 2>&1" & """"
    Application.StatusBar = "Exporting math config..."
    code = CreateObject("WScript.Shell").Run(cmd, 0, True)
    Application.StatusBar = False

    If code = 0 Then
        MsgBox "Math config exported to " & CONFIG_OUT & "." & vbCrLf & vbCrLf & LastLines(ReadText(logPath), 4), _
               vbInformation, "Export Math Config"
    Else
        MsgBox "Export failed. Nothing was written." & vbCrLf & vbCrLf & LastLines(ReadText(logPath), 25) & vbCrLf & vbCrLf & _
               "(If this says 'npm' is not recognized, install Node.js from nodejs.org, run Setup.bat, then close and reopen Excel.)", _
               vbExclamation, "Export Math Config"
    End If
End Sub

' ---------- Import ----------

Public Sub ImportSimResults()
    Dim root As String, path As String
    root = RepoRoot()
    If root = "" Then Exit Sub
    path = root & "\" & LATEST_REPORT
    If Dir(path) = "" Then
        MsgBox "No simulation results yet (" & LATEST_REPORT & " not found)." & vbCrLf & _
               "Run ""Run Simulation.bat"" first.", vbExclamation, "Import Sim Results"
        Exit Sub
    End If
    LoadReport path
End Sub

Public Sub ImportSimResultsFile()
    Dim root As String, pick As Variant
    root = RepoRoot()
    If root <> "" Then
        If Dir(root & "\reports", vbDirectory) <> "" Then ChDrive Left$(root, 1): ChDir root & "\reports"
    End If
    pick = Application.GetOpenFilename("Simulation reports (*.txt),*.txt", , "Choose a simulation report")
    If VarType(pick) = vbBoolean Then Exit Sub
    LoadReport CStr(pick)
End Sub

Private Sub LoadReport(ByVal path As String)
    Dim text As String, lines() As String, cols() As String
    Dim ws As Worksheet, r As Long, c As Long, n As Long, maxCols As Long
    Dim data() As Variant

    text = ReadText(path)
    text = Replace(text, vbCrLf, vbLf)
    If Right$(text, 1) = vbLf Then text = Left$(text, Len(text) - 1)
    lines = Split(text, vbLf)
    n = UBound(lines) + 1
    For r = 0 To n - 1
        cols = Split(lines(r), vbTab)
        If UBound(cols) + 1 > maxCols Then maxCols = UBound(cols) + 1
    Next r
    If n = 0 Or maxCols = 0 Then MsgBox "The report is empty.", vbExclamation: Exit Sub

    ReDim data(1 To n, 1 To maxCols)
    For r = 0 To n - 1
        cols = Split(lines(r), vbTab)
        For c = 0 To UBound(cols)
            data(r + 1, c + 1) = CellValue(cols(c))
        Next c
    Next r

    Set ws = ResultsSheet()
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ws.Range("A1").Resize(1, 1).Value = "Imported " & Format$(Now, "yyyy-mm-dd hh:nn") & " from " & path
    ws.Range("A1").Font.Italic = True
    With ws.Range("A3").Resize(n, maxCols)
        .NumberFormat = "@"
        .Value = data
    End With
    ' Plain numbers (counts, seeds) become real numbers; everything else stays as text.
    For r = 1 To n
        For c = 1 To maxCols
            If IsPlainNumber(CStr(data(r, c))) Then
                ws.Cells(r + 2, c).NumberFormat = "General"
                ws.Cells(r + 2, c).Value = Val(data(r, c))
            End If
        Next c
    Next r
    ws.Range("A3").Resize(1, maxCols).Font.Bold = True
    ws.Columns("A:" & Split(ws.Cells(1, maxCols).Address(True, False), "$")(0)).AutoFit
    ws.Columns("A").ColumnWidth = 20
    Application.ScreenUpdating = True
    ws.Activate
    ws.Range("A3").Select
    MsgBox "Imported " & n & " rows into the """ & RESULTS_SHEET & """ tab.", vbInformation, "Import Sim Results"
End Sub

Private Function CellValue(ByVal s As String) As String
    If Left$(s, 1) = ChrW$(65279) Then s = Mid$(s, 2)
    CellValue = s
End Function

Private Function IsPlainNumber(ByVal s As String) As Boolean
    Dim i As Long, ch As String, dots As Long
    If Len(s) = 0 Or Len(s) > 15 Then Exit Function
    For i = 1 To Len(s)
        ch = Mid$(s, i, 1)
        If ch = "." Then
            dots = dots + 1
        ElseIf ch = "-" Then
            If i <> 1 Then Exit Function
        ElseIf ch < "0" Or ch > "9" Then
            Exit Function
        End If
    Next i
    IsPlainNumber = dots <= 1 And s <> "-" And s <> "."
End Function

Private Function ResultsSheet() As Worksheet
    On Error Resume Next
    Set ResultsSheet = ThisWorkbook.Worksheets(RESULTS_SHEET)
    On Error GoTo 0
    If ResultsSheet Is Nothing Then
        Set ResultsSheet = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ResultsSheet.Name = RESULTS_SHEET
    End If
End Function

' ---------- Tools tab ----------

Public Sub InstallToolButtons()
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(TOOLS_SHEET)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = TOOLS_SHEET
    End If
    If ws.Buttons.Count > 0 Then ws.Buttons.Delete
    ws.Cells.Clear
    ws.Range("A1").Value = "Claude-Proto tools"
    ws.Range("A1").Font.Bold = True
    ws.Range("A1").Font.Size = 14
    AddButton ws, 3, "Export Math Config", "ExportMathConfig", _
        "Saves this workbook and writes math\proto_v2.config.json. A running prototype reloads by itself."
    AddButton ws, 6, "Import Sim Results", "ImportSimResults", _
        "Loads the latest simulation (reports\sim-latest.txt) into the Sim Results tab."
    AddButton ws, 9, "Import Other Results...", "ImportSimResultsFile", _
        "Pick an older report from the reports folder."
    ws.Range("A13").Value = "In the project folder (double-click):"
    ws.Range("A13").Font.Bold = True
    ws.Range("A14").Value = "Setup.bat - one time, after installing Node.js from nodejs.org"
    ws.Range("A15").Value = "Play Prototype.bat - plays the game in your browser"
    ws.Range("A16").Value = "Run Simulation.bat - simulates the exported math, then use Import Sim Results"
    ws.Activate
End Sub

Private Sub AddButton(ws As Worksheet, ByVal row As Long, ByVal caption As String, ByVal macro As String, ByVal help As String)
    Dim cell As Range, b As Object
    Set cell = ws.Cells(row, 1)
    Set b = ws.Buttons.Add(cell.Left, cell.Top, 160, 30)
    b.Caption = caption
    b.OnAction = macro
    ws.Cells(row, 4).Value = help
End Sub

' ---------- Paths and files ----------

' The repository folder: the parent of the folder this workbook is in (math\).
Private Function RepoRoot() As String
    Dim wbDir As String
    wbDir = LocalPath(ThisWorkbook.path)
    If wbDir = "" Then Exit Function
    RepoRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(wbDir)
    If Dir(RepoRoot & "\package.json") = "" Then
        MsgBox "This workbook must be in the project's math folder (couldn't find package.json in " & RepoRoot & ").", _
               vbExclamation, "Claude-Proto tools"
        RepoRoot = ""
    End If
End Function

' Excel reports OneDrive-synced files as https:// addresses. Map them back to the local folder.
Private Function LocalPath(ByVal p As String) As String
    Dim rest As String, roots As Variant, i As Long, candidate As String, k As Long, fso As Object
    If LCase$(Left$(p, 4)) <> "http" Then LocalPath = p: Exit Function
    Set fso = CreateObject("Scripting.FileSystemObject")
    rest = UrlDecode(p)
    k = InStr(1, rest, "/Documents/", vbTextCompare)
    If InStr(1, rest, "docs.live.net", vbTextCompare) > 0 Then
        ' https://d.docs.live.net/<id>/<path>
        rest = Mid$(rest, InStr(InStr(InStr(rest, "//") + 2, rest, "/") + 1, rest, "/") + 1)
    ElseIf k > 0 Then
        ' https://<tenant>-my.sharepoint.com/personal/<user>/Documents/<path>
        rest = Mid$(rest, k + Len("/Documents/"))
    End If
    rest = Replace(rest, "/", "\")
    roots = Array(Environ$("OneDrive"), Environ$("OneDriveConsumer"), Environ$("OneDriveCommercial"))
    For i = LBound(roots) To UBound(roots)
        If roots(i) <> "" Then
            candidate = roots(i) & "\" & rest
            If fso.FolderExists(candidate) Or fso.FileExists(candidate) Then LocalPath = candidate: Exit Function
        End If
    Next i
    MsgBox "Couldn't find the local folder for this OneDrive file:" & vbCrLf & p & vbCrLf & vbCrLf & _
           "Move the project folder out of OneDrive (for example to C:\work\Claude-Proto) and try again.", _
           vbExclamation, "Claude-Proto tools"
    LocalPath = ""
End Function

Private Function UrlDecode(ByVal s As String) As String
    Dim i As Long, out As String
    i = 1
    Do While i <= Len(s)
        If Mid$(s, i, 1) = "%" And i + 2 <= Len(s) Then
            out = out & Chr$(CLng("&H" & Mid$(s, i + 1, 2)))
            i = i + 3
        Else
            out = out & Mid$(s, i, 1)
            i = i + 1
        End If
    Loop
    UrlDecode = out
End Function

Private Function ReadText(ByVal path As String) As String
    Dim st As Object
    If Dir(path) = "" Then Exit Function
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2
    st.Charset = "utf-8"
    st.Open
    st.LoadFromFile path
    ReadText = st.ReadText
    st.Close
End Function

Private Function LastLines(ByVal text As String, ByVal count As Long) As String
    Dim lines() As String, i As Long, first As Long, out As String
    text = Replace(Trim$(Replace(text, vbCrLf, vbLf)), vbCr, "")
    If text = "" Then Exit Function
    lines = Split(text, vbLf)
    first = UBound(lines) - count + 1
    If first < 0 Then first = 0
    For i = first To UBound(lines)
        out = out & lines(i) & vbCrLf
    Next i
    LastLines = out
End Function
