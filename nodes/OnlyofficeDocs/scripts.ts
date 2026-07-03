/**
 * Document Builder script templates.
 *
 * Each template contains %%PLACEHOLDER%% markers that are replaced at runtime
 * before being sent to the Document Server /docbuilder endpoint.
 */

export const EXTRACT_TEXT = `builder.OpenFile("%%FILE_URL%%");

var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();
var result = [];

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    var classType = element.GetClassType();

    if (classType === "paragraph") {
        var text = element.GetText().split("\\r\\n").join("\\n").split("\\r").join("\\n").trim();
        if (text.length > 0) {
            result.push({
                type: "paragraph",
                text: text,
                index: i
            });
        }
    } else if (classType === "table") {
        var tableData = [];
        var rowCount = element.GetRowsCount();
        for (var r = 0; r < rowCount; r++) {
            var row = element.GetRow(r);
            var cellCount = row.GetCellsCount();
            var rowData = [];
            for (var c = 0; c < cellCount; c++) {
                var cell = row.GetCell(c);
                var cellContent = cell.GetContent();
                var cellText = "";
                var cellParaCount = cellContent.GetElementsCount();
                for (var p = 0; p < cellParaCount; p++) {
                    var para = cellContent.GetElement(p);
                    if (para.GetClassType() === "paragraph") {
                        cellText += para.GetText();
                        if (p < cellParaCount - 1) cellText += "\\n";
                    }
                }
                rowData.push(cellText);
            }
            tableData.push(rowData);
        }
        result.push({
            type: "table",
            rows: tableData,
            index: i
        });
    }
}

// Replace document content with JSON output (same session)
for (var j = oDocument.GetElementsCount() - 1; j >= 0; j--) {
    oDocument.RemoveElement(j);
}
var oParagraph = Api.CreateParagraph();
oParagraph.AddText(JSON.stringify(result));
oDocument.Push(oParagraph);

builder.SaveFile("txt", "output.txt");
builder.CloseFile();
`;

export const EXTRACT_OUTLINE = `builder.OpenFile("%%FILE_URL%%");

var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();
var outline = [];

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    if (element.GetClassType() === "paragraph") {
        var style = element.GetStyle();
        var styleName = style ? style.GetName() : "";
        var level = -1;

        if (styleName.indexOf("Heading") === 0 || styleName.indexOf("heading") === 0) {
            var match = styleName.match(/\\d+/);
            if (match) {
                level = parseInt(match[0], 10);
            }
        }

        if (level > 0) {
            outline.push({
                level: level,
                text: element.GetText().split("\\r\\n").join("\\n").split("\\r").join("\\n").trim(),
                index: i
            });
        }
    }
}

for (var j = oDocument.GetElementsCount() - 1; j >= 0; j--) {
    oDocument.RemoveElement(j);
}
var oParagraph = Api.CreateParagraph();
oParagraph.AddText(JSON.stringify(outline));
oDocument.Push(oParagraph);

builder.SaveFile("txt", "output.txt");
builder.CloseFile();
`;

export const EXTRACT_TABLES = `builder.OpenFile("%%FILE_URL%%");

var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();
var tables = [];

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    if (element.GetClassType() === "table") {
        var rowCount = element.GetRowsCount();
        var rows = [];
        var headers = [];

        for (var r = 0; r < rowCount; r++) {
            var row = element.GetRow(r);
            var cellCount = row.GetCellsCount();
            var rowData = [];

            for (var c = 0; c < cellCount; c++) {
                var cell = row.GetCell(c);
                var cellContent = cell.GetContent();
                var cellText = "";
                var cellParaCount = cellContent.GetElementsCount();
                for (var p = 0; p < cellParaCount; p++) {
                    var para = cellContent.GetElement(p);
                    if (para.GetClassType() === "paragraph") {
                        if (p > 0) cellText += "\\n";
                        cellText += para.GetText();
                    }
                }
                rowData.push(cellText.trim());
            }

            if (r === 0) {
                headers = rowData;
            }
            rows.push(rowData);
        }

        var records = [];
        for (var ri = 1; ri < rows.length; ri++) {
            var record = {};
            for (var ci = 0; ci < headers.length; ci++) {
                var key = headers[ci] || ("col_" + ci);
                record[key] = rows[ri][ci] || "";
            }
            records.push(record);
        }

        tables.push({
            tableIndex: i,
            headers: headers,
            rows: rows,
            records: records
        });
    }
}

for (var j = oDocument.GetElementsCount() - 1; j >= 0; j--) {
    oDocument.RemoveElement(j);
}
var oParagraph = Api.CreateParagraph();
oParagraph.AddText(JSON.stringify(tables));
oDocument.Push(oParagraph);

builder.SaveFile("txt", "output.txt");
builder.CloseFile();
`;

export const EXTRACT_CHUNKS = `builder.OpenFile("%%FILE_URL%%");

var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();
var chunks = [];
var chunkBy = "%%CHUNK_BY%%";

function cleanText(t) {
    return t.split("\\r\\n").join("\\n").split("\\r").join("\\n").trim();
}

var currentSection = "";
var currentHeadingLevel = 0;
var currentChunkText = "";
var currentChunkStart = 0;

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    var classType = element.GetClassType();

    if (classType === "paragraph") {
        var style = element.GetStyle();
        var styleName = style ? style.GetName() : "";
        var isHeading = styleName.indexOf("Heading") === 0 || styleName.indexOf("heading") === 0;

        if (isHeading) {
            if (chunkBy === "headings" && currentChunkText.trim().length > 0) {
                chunks.push({
                    text: currentChunkText.trim(),
                    metadata: { section: currentSection, headingLevel: currentHeadingLevel, elementStart: currentChunkStart, elementEnd: i - 1 }
                });
                currentChunkText = "";
                currentChunkStart = i;
            }
            var matchResult = styleName.match(/\\d+/);
            currentHeadingLevel = matchResult ? parseInt(matchResult[0], 10) : 1;
            currentSection = cleanText(element.GetText());
        }

        var paraText = cleanText(element.GetText());
        if (paraText.length > 0) {
            if (chunkBy === "paragraphs") {
                chunks.push({
                    text: paraText,
                    metadata: { section: currentSection, headingLevel: currentHeadingLevel, isHeading: isHeading, elementIndex: i }
                });
            } else {
                currentChunkText += paraText + "\\n\\n";
            }
        }
    } else if (classType === "table") {
        var tableText = "";
        var rowCount = element.GetRowsCount();
        for (var r = 0; r < rowCount; r++) {
            var row = element.GetRow(r);
            var cellCount = row.GetCellsCount();
            var rowCells = [];
            for (var c = 0; c < cellCount; c++) {
                var cell = row.GetCell(c);
                var cellContent = cell.GetContent();
                var cellText = "";
                var cellParaCount = cellContent.GetElementsCount();
                for (var p = 0; p < cellParaCount; p++) {
                    var para = cellContent.GetElement(p);
                    if (para.GetClassType() === "paragraph") {
                        cellText += para.GetText().trim();
                    }
                }
                rowCells.push(cellText);
            }
            tableText += rowCells.join(" | ") + "\\n";
        }
        if (tableText.trim().length > 0) {
            if (chunkBy === "paragraphs") {
                chunks.push({
                    text: tableText.trim(),
                    metadata: { section: currentSection, headingLevel: currentHeadingLevel, isHeading: false, elementIndex: i }
                });
            } else {
                currentChunkText += tableText;
            }
        }
    }
}

if (chunkBy !== "paragraphs" && currentChunkText.trim().length > 0) {
    chunks.push({
        text: currentChunkText.trim(),
        metadata: { section: currentSection, headingLevel: currentHeadingLevel, elementStart: currentChunkStart, elementEnd: count - 1 }
    });
}

for (var j = oDocument.GetElementsCount() - 1; j >= 0; j--) {
    oDocument.RemoveElement(j);
}
var oParagraph = Api.CreateParagraph();
oParagraph.AddText(JSON.stringify(chunks));
oDocument.Push(oParagraph);

builder.SaveFile("txt", "output.txt");
builder.CloseFile();
`;

export const FILL_TEMPLATE = `builder.OpenFile("%%FILE_URL%%");
var data = JSON.parse(%%DATA_JSON%%);

var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();

function replacePlaceholders(text, data) {
    var result = text;
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            var placeholder = "{{" + key + "}}";
            while (result.indexOf(placeholder) !== -1) {
                result = result.replace(placeholder, String(data[key]));
            }
        }
    }
    return result;
}

function processElement(element) {
    var classType = element.GetClassType();
    if (classType === "paragraph") {
        var text = element.GetText();
        var replaced = replacePlaceholders(text, data);
        if (text !== replaced) {
            element.RemoveAllElements();
            var oRun = Api.CreateRun();
            oRun.AddText(replaced);
            element.AddElement(oRun);
        }
    } else if (classType === "table") {
        var rowCount = element.GetRowsCount();
        for (var r = 0; r < rowCount; r++) {
            var row = element.GetRow(r);
            var cellCount = row.GetCellsCount();
            for (var c = 0; c < cellCount; c++) {
                var cell = row.GetCell(c);
                var cellContent = cell.GetContent();
                var paraCount = cellContent.GetElementsCount();
                for (var p = 0; p < paraCount; p++) {
                    var para = cellContent.GetElement(p);
                    processElement(para);
                }
            }
        }
    }
}

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    processElement(element);
}

builder.SaveFile("%%OUTPUT_FORMAT%%", "output.%%OUTPUT_FORMAT%%");
builder.CloseFile();
`;

export const JSON_TO_TABLE = `var rows = JSON.parse(%%ROWS_JSON%%);
var title = "%%TABLE_TITLE%%";

builder.CreateFile("docx");
var oDocument = Api.GetDocument();

if (title.length > 0) {
    var oTitlePara = oDocument.GetElement(0);
    oTitlePara.AddText(title);
    oTitlePara.SetBold(true);
    oTitlePara.SetFontSize(28);
    oTitlePara.SetSpacingAfter(200);
}

if (rows.length > 0) {
    var headers = [];
    for (var key in rows[0]) {
        if (rows[0].hasOwnProperty(key)) {
            headers.push(key);
        }
    }

    var oTable = Api.CreateTable(rows.length + 1, headers.length);
    oTable.SetWidth("percent", 100);

    for (var h = 0; h < headers.length; h++) {
        var headerCell = oTable.GetRow(0).GetCell(h);
        var headerPara = headerCell.GetContent().GetElement(0);
        headerPara.AddText(headers[h]);
        headerPara.SetBold(true);
    }

    for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < headers.length; c++) {
            var cell = oTable.GetRow(r + 1).GetCell(c);
            var cellPara = cell.GetContent().GetElement(0);
            var value = rows[r][headers[c]];
            cellPara.AddText(value !== null && value !== undefined ? String(value) : "");
        }
    }

    oDocument.Push(oTable);
}

builder.SaveFile("%%OUTPUT_FORMAT%%", "output.%%OUTPUT_FORMAT%%");
builder.CloseFile();
`;

export const MARKDOWN_TO_DOC = `builder.CreateFile("docx");
var markdown = JSON.parse(%%MARKDOWN_JSON%%);
var oDocument = Api.GetDocument();

var lines = markdown.split("\\n");
var inCodeBlock = false;
var codeLines = [];

for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (line.indexOf("\`\`\`") === 0) {
        if (inCodeBlock) {
            var codePara = Api.CreateParagraph();
            codePara.AddText(codeLines.join("\\n"));
            codePara.SetFontFamily("Courier New");
            codePara.SetFontSize(18);
            codePara.SetShd("clear", 240, 240, 240);
            oDocument.Push(codePara);
            codeLines = [];
            inCodeBlock = false;
        } else {
            inCodeBlock = true;
        }
        continue;
    }

    if (inCodeBlock) {
        codeLines.push(line);
        continue;
    }

    if (line.trim().length === 0) {
        continue;
    }

    var oParagraph = Api.CreateParagraph();
    var headingLevel = 0;

    if (line.indexOf("######") === 0) { headingLevel = 6; line = line.substring(6).trim(); }
    else if (line.indexOf("#####") === 0) { headingLevel = 5; line = line.substring(5).trim(); }
    else if (line.indexOf("####") === 0) { headingLevel = 4; line = line.substring(4).trim(); }
    else if (line.indexOf("###") === 0) { headingLevel = 3; line = line.substring(3).trim(); }
    else if (line.indexOf("##") === 0) { headingLevel = 2; line = line.substring(2).trim(); }
    else if (line.indexOf("#") === 0) { headingLevel = 1; line = line.substring(1).trim(); }

    if (headingLevel > 0) {
        oParagraph.SetStyle(oDocument.GetStyle("Heading " + headingLevel));
    }

    if (line.indexOf("- ") === 0 || line.indexOf("* ") === 0) {
        line = line.substring(2);
        oParagraph.SetBullet(Api.CreateBullet("-"));
    } else if (/^\\d+\\.\\s/.test(line)) {
        line = line.replace(/^\\d+\\.\\s/, "");
        oParagraph.SetNumbering(Api.CreateNumbering("numbered"));
    }

    var parts = line.split(/(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|\`[^\`]+\`)/);
    for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        if (part.length === 0) continue;

        var oRun = Api.CreateRun();
        if (part.indexOf("**") === 0 && part.lastIndexOf("**") === part.length - 2) {
            oRun.AddText(part.substring(2, part.length - 2));
            oRun.SetBold(true);
        } else if (part.indexOf("*") === 0 && part.lastIndexOf("*") === part.length - 1 && part.length > 2) {
            oRun.AddText(part.substring(1, part.length - 1));
            oRun.SetItalic(true);
        } else if (part.indexOf("\`") === 0 && part.lastIndexOf("\`") === part.length - 1) {
            oRun.AddText(part.substring(1, part.length - 1));
            oRun.SetFontFamily("Courier New");
            oRun.SetShd("clear", 240, 240, 240);
        } else {
            oRun.AddText(part);
        }
        oParagraph.AddElement(oRun);
    }

    oDocument.Push(oParagraph);
}

builder.SaveFile("%%OUTPUT_FORMAT%%", "output.%%OUTPUT_FORMAT%%");
builder.CloseFile();
`;

export const CREATE_DOCUMENT = `builder.CreateFile("docx");
var oDocument = Api.GetDocument();
var title = "%%TITLE%%";
if (title.length > 0) {
    var oTitleParagraph = oDocument.GetElement(0);
    oTitleParagraph.AddText(title);
    oTitleParagraph.SetBold(true);
    oTitleParagraph.SetFontSize(28);
    oTitleParagraph.SetSpacingAfter(200);
}
var lines = JSON.parse(%%LINES_JSON%%);
for (var i = 0; i < lines.length; i++) {
    var oParagraph = Api.CreateParagraph();
    oParagraph.AddText(lines[i]);
    oDocument.Push(oParagraph);
}

builder.SaveFile("%%OUTPUT_FORMAT%%", "output.%%OUTPUT_FORMAT%%");
builder.CloseFile();
`;

export const GENERATE_SPREADSHEET = `var rows = JSON.parse(%%ROWS_JSON%%);
var sheetTitle = "%%SHEET_TITLE%%";

builder.CreateFile("xlsx");
var oWorksheet = Api.GetActiveSheet();

if (sheetTitle.length > 0) {
    oWorksheet.SetName(sheetTitle);
}

if (rows.length > 0) {
    var headers = [];
    for (var key in rows[0]) {
        if (rows[0].hasOwnProperty(key)) headers.push(key);
    }

    for (var h = 0; h < headers.length; h++) {
        var headerCell = oWorksheet.GetRangeByNumber(0, h);
        headerCell.SetValue(headers[h]);
        headerCell.SetBold(true);
    }

    for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < headers.length; c++) {
            var val = rows[r][headers[c]];
            oWorksheet.GetRangeByNumber(r + 1, c).SetValue(val !== null && val !== undefined ? val : "");
        }
    }
}

builder.SaveFile("xlsx", "output.xlsx");
builder.CloseFile();
`;

export const GENERATE_PRESENTATION = `var slides = JSON.parse(%%SLIDES_JSON%%);

builder.CreateFile("pptx");
var oPresentation = Api.GetPresentation();

function hexToRgb(hex) {
    var clean = String(hex || "#000000").replace("#", "");
    if (clean.length === 3) {
        clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    return {
        r: parseInt(clean.slice(0, 2), 16) || 0,
        g: parseInt(clean.slice(2, 4), 16) || 0,
        b: parseInt(clean.slice(4, 6), 16) || 0
    };
}

for (var s = 0; s < slides.length; s++) {
    var oSlide = Api.CreateSlide();
    oPresentation.AddSlide(oSlide);

    var slideData = slides[s];

    var bg = hexToRgb(slideData.background || "#FFFFFF");
    oSlide.SetBackground(Api.CreateSolidFill(Api.CreateRGBColor(bg.r, bg.g, bg.b)));

    if (slideData.title) {
        var oTitleShape = Api.CreateShape("rect", 8229600, 1143000, Api.CreateNoFill(), Api.CreateStroke(0, Api.CreateNoFill()));
        oTitleShape.SetPosition(457200, 274638);
        var oTitleContent = oTitleShape.GetDocContent();
        oTitleContent.RemoveAllElements();
        var oTitlePara = Api.CreateParagraph();
        oTitlePara.SetJc(slideData.titleAlign || "left");
        oTitleContent.Push(oTitlePara);
        var oTitleRun = oTitlePara.AddText(slideData.title);
        var titleRgb = hexToRgb(slideData.titleColor || "#000000");
        oTitleRun.SetFill(Api.CreateSolidFill(Api.CreateRGBColor(titleRgb.r, titleRgb.g, titleRgb.b)));
        oTitleRun.SetBold(slideData.titleBold !== false);
        oTitleRun.SetFontSize(slideData.titleSize || 40);
        oSlide.AddObject(oTitleShape);
    }

    if (slideData.body) {
        var oBodyShape = Api.CreateShape("rect", 8229600, 4525963, Api.CreateNoFill(), Api.CreateStroke(0, Api.CreateNoFill()));
        oBodyShape.SetPosition(457200, 1600200);
        var oBodyContent = oBodyShape.GetDocContent();
        oBodyContent.RemoveAllElements();
        var oBodyPara = Api.CreateParagraph();
        oBodyPara.SetJc(slideData.bodyAlign || "left");
        oBodyContent.Push(oBodyPara);
        var oBodyRun = oBodyPara.AddText(slideData.body);
        var bodyRgb = hexToRgb(slideData.bodyColor || "#000000");
        oBodyRun.SetFill(Api.CreateSolidFill(Api.CreateRGBColor(bodyRgb.r, bodyRgb.g, bodyRgb.b)));
        oBodyRun.SetBold(slideData.bodyBold === true);
        oBodyRun.SetFontSize(slideData.bodySize || 24);
        oSlide.AddObject(oBodyShape);
    }
}

oPresentation.GetSlideByIndex(0).Delete();

builder.SaveFile("pptx", "output.pptx");
builder.CloseFile();
`;

export const APPEND_ROWS = `builder.OpenFile("%%FILE_URL%%");
var oWorksheet = Api.GetActiveSheet();
var newRows = JSON.parse(%%ROWS_JSON%%);

var headers = [];
for (var h = 0; h < 200; h++) {
    var hVal = String(oWorksheet.GetRangeByNumber(0, h).GetText() || "").trim();
    if (!hVal) break;
    headers.push(hVal);
}

var lastRow = 1;
for (var r = 1; r < 100000; r++) {
    var firstCell = String(oWorksheet.GetRangeByNumber(r, 0).GetText() || "").trim();
    if (!firstCell) { lastRow = r; break; }
    if (r === 99999) { lastRow = r + 1; break; }
}

for (var i = 0; i < newRows.length; i++) {
    var row = newRows[i];
    if (headers.length > 0) {
        for (var c = 0; c < headers.length; c++) {
            var cellVal = row[headers[c]];
            oWorksheet.GetRangeByNumber(lastRow + i, c).SetValue(cellVal !== null && cellVal !== undefined ? cellVal : "");
        }
    } else {
        var col = 0;
        for (var key in row) {
            if (row.hasOwnProperty(key)) {
                var keyVal = row[key];
                oWorksheet.GetRangeByNumber(lastRow + i, col).SetValue(keyVal !== null && keyVal !== undefined ? keyVal : "");
                col++;
            }
        }
    }
}

builder.SaveFile("xlsx", "output.xlsx");
builder.CloseFile();
`;

export const UPDATE_ROW = `builder.OpenFile("%%FILE_URL%%");
var oWorksheet = Api.GetActiveSheet();
var searchColumn = "%%SEARCH_COLUMN%%";
var searchValue = "%%SEARCH_VALUE%%";
var updates = JSON.parse(%%UPDATES_JSON%%);

var headers = {};
for (var h = 0; h < 200; h++) {
    var hVal = String(oWorksheet.GetRangeByNumber(0, h).GetText() || "").trim();
    if (!hVal) break;
    headers[hVal] = h;
}

var searchColIdx = headers[searchColumn] !== undefined ? headers[searchColumn] : 0;

for (var r = 1; r < 100000; r++) {
    var firstCell = String(oWorksheet.GetRangeByNumber(r, 0).GetText() || "").trim();
    if (!firstCell) break;
    var cellVal = oWorksheet.GetRangeByNumber(r, searchColIdx).GetValue();
    if (String(cellVal) === searchValue) {
        for (var key in updates) {
            if (updates.hasOwnProperty(key) && headers[key] !== undefined) {
                oWorksheet.GetRangeByNumber(r, headers[key]).SetValue(updates[key]);
            }
        }
    }
}

builder.SaveFile("xlsx", "output.xlsx");
builder.CloseFile();
`;

export const EXTRACT_METADATA = `builder.OpenFile("%%FILE_URL%%");
var oDocument = Api.GetDocument();
var count = oDocument.GetElementsCount();

var paragraphCount = 0;
var tableCount = 0;
var wordCount = 0;
var charCount = 0;
var headingCount = 0;

for (var i = 0; i < count; i++) {
    var element = oDocument.GetElement(i);
    var cls = element.GetClassType();

    if (cls === "paragraph") {
        paragraphCount++;
        var style = element.GetStyle();
        var styleName = style ? style.GetName() : "";
        if (styleName.indexOf("Heading") === 0 || styleName.indexOf("heading") === 0) {
            headingCount++;
        }
        var text = element.GetText();
        charCount += text.length;
        if (text.trim().length > 0) {
            wordCount += text.trim().split(/\\s+/).length;
        }
    } else if (cls === "table") {
        tableCount++;
    }
}

var metadata = {
    paragraphs: paragraphCount,
    headings: headingCount,
    tables: tableCount,
    estimatedWords: wordCount,
    characters: charCount
};

for (var j = oDocument.GetElementsCount() - 1; j >= 0; j--) {
    oDocument.RemoveElement(j);
}
var oParagraph = Api.CreateParagraph();
oParagraph.AddText(JSON.stringify(metadata));
oDocument.Push(oParagraph);

builder.SaveFile("txt", "output.txt");
builder.CloseFile();
`;

export const APPEND_CONTENT = `builder.OpenFile("%%FILE_URL%%");
var oDocument = Api.GetDocument();
var paragraphs = JSON.parse(%%PARAGRAPHS_JSON%%);

for (var i = 0; i < paragraphs.length; i++) {
    var item = paragraphs[i];
    var oPara = Api.CreateParagraph();
    var text = typeof item === "string" ? item : (typeof item === "object" && item !== null ? (item.text || "") : String(item));
    if (typeof item === "object" && item.bold) {
        oPara.SetBold(true);
    }
    oPara.AddText(text);
    oDocument.Push(oPara);
}

builder.SaveFile("%%OUTPUT_FORMAT%%", "output.%%OUTPUT_FORMAT%%");
builder.CloseFile();
`;
