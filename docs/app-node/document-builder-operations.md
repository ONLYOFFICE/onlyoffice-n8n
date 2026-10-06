# ONLYOFFICE Docs Document Builder operations

Use these operations to build documents, fill templates and extract data from
documents with the Document Builder service of ONLYOFFICE Document Server.
Refer to [ONLYOFFICE Docs][App Node] for more information on the ONLYOFFICE
Docs node itself.

> [!NOTE]
>
> The Document Builder operations require ONLYOFFICE Docs Developer Edition.

## Input and output parameters

The operations that read a document take the **File URL** parameter: the URL
of the document. The URL must be reachable from the Document Server. To pass
the result of a previous Document Builder step, use `{{ $json.outputUrl }}`.

The operations that create a file take these parameters:

- **Output Mode**: Select how to return the result.
  - Select **File Data** to download the file and return it as binary data.
  - Select **URL Only** to return only the URL of the file on the Document
    Server. The URL is temporary.
- **Output Format**: Select **DOCX**, **PDF** or **PPTX**. Shown for the
  operations that create a text document.
- **Output File Name**: Enter the name of the output file without an
  extension.
- **Put Output File in Field**: Enter the field name to place the binary file
  contents to make it available to following nodes.

The output item contains `fileName`, `operation` and `outputUrl`, and the file
in the binary field unless **Output Mode** is **URL Only**.

## Append content to a document

Use this operation to add paragraphs to the end of an existing document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Append Content to Document**.
- **File URL**: Enter the URL of the document.
- **Paragraphs (JSON Array)**: Enter the paragraphs to append. Each item is a
  string or an object with `text` and an optional `bold` flag, for example,
  `["Intro", { "text": "Note", "bold": true }]`.
- The [output parameters](#input-and-output-parameters).

## Append rows to a spreadsheet

Use this operation to add rows to an existing XLSX spreadsheet.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Append Rows to Spreadsheet**.
- **File URL**: Enter the URL of the XLSX spreadsheet.
- **Table Data (JSON Array)**: Enter the rows as an array of objects. Object
  keys must match the column headers of the spreadsheet exactly. To append the
  rows of an extracted table, use `{{ $json.records }}`.
- The [output parameters](#input-and-output-parameters).

## Create a document

Use this operation to create a document from plain text.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Create Document**.
- **Text**: Enter the text of the document. Each line becomes a separate
  paragraph.
- The [output parameters](#input-and-output-parameters).

### Options

- **Title**: Enter a bold heading to insert at the top of the document.

## Extract chunks

Use this operation to split a document into text chunks, for example, to
create embeddings for an AI workflow.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Extract Chunks**.
- **File URL**: Enter the URL of the document.
- **Chunk By**: Select how to split the document.
  - Select **By Headings** to get one chunk per heading section. The metadata
    contains `section`, `headingLevel`, `elementStart` and `elementEnd`.
  - Select **By Paragraphs** to get one chunk per paragraph or table row. The
    metadata contains `section`, `headingLevel`, `isHeading` and
    `elementIndex`.

The node returns one item per chunk with `text` and `metadata`. Use
`{{ $json.text }}` in AI and embedding nodes.

## Extract metadata

Use this operation to get the statistics of a document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Extract Metadata**.
- **File URL**: Enter the URL of the document.

The node returns one item with `paragraphs`, `estimatedWords`, `characters`,
`headings` and `tables`.

## Extract an outline

Use this operation to get the headings of a document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Extract Outline**.
- **File URL**: Enter the URL of the document.

The node returns one item per heading with `level` (1–6) and `text`.

## Extract tables

Use this operation to get the tables of a document as JSON.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Extract Tables**.
- **File URL**: Enter the URL of the document.

The node returns one item per table with `tableIndex`, `headers`, `rows` and
`records`. Pass `{{ $json.records }}` to **Generate Spreadsheet**, **Append Rows
to Spreadsheet** or **JSON to Table**.

## Extract text

Use this operation to get the text of a document as structured JSON.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Extract Text**.
- **File URL**: Enter the URL of the document.

The node returns one item with `paragraphs` (each with `type`, `text` and
`level`) and `tables`.

## Fill a template

Use this operation to create a document from a template by replacing its
`{{key}}` placeholders.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Fill Template**.
- **File URL**: Enter the URL of the template document.
- **Template Data (JSON Object)**: Enter the values for the placeholders, for
  example, `{ "name": "Alice", "date": "2024-01-01" }`. Use `{{ $json }}` to
  use all fields of the current item.
- The [output parameters](#input-and-output-parameters).

The formatting of the template is kept.

## Generate a presentation

Use this operation to create a PPTX presentation from slide data.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Generate Presentation**.
- **Slides Data (JSON Array)**: Enter the slides as an array of objects. Each
  object supports `title`, `body`, `background` (hex color), `titleColor`,
  `titleSize` (half-points), `titleBold`, `titleAlign` (`left`, `center` or
  `right`), `bodyColor`, `bodySize`, `bodyBold` and `bodyAlign`, for example,
  `[{ "title": "Slide 1", "body": "Content here" }]`.
- The [output parameters](#input-and-output-parameters).

## Generate a spreadsheet

Use this operation to create an XLSX spreadsheet from JSON data.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Generate Spreadsheet**.
- **Table Data (JSON Array)**: Enter the rows as an array of objects. Object
  keys become the column headers in the first row, for example,
  `[{ "Name": "Alice", "Score": 95 }]`.
- The [output parameters](#input-and-output-parameters).

### Options

- **Table Title**: Enter the name of the worksheet.

## Create a table from JSON

Use this operation to create a document with a formatted table from JSON data.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **JSON to Table**.
- **Table Data (JSON Array)**: Enter the rows as an array of objects. Object
  keys become the column headers.
- The [output parameters](#input-and-output-parameters).

### Options

- **Table Title**: Enter a heading to insert above the table.

## Run a mail merge

Use this operation to create one document per record from a template.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Mail Merge**.
- **File URL**: Enter the URL of the template document.
- **Records (JSON Array)**: Enter the records as an array of objects. Object
  keys replace the `{{key}}` placeholders of the template, for example,
  `[{ "name": "Alice" }, { "name": "Bob" }]`.
- The [output parameters](#input-and-output-parameters).

The node returns one item per record with `success`, `fileName`
(`<Output File Name>_<number>.<format>`), `recordIndex`, `record` and
`outputUrl`, and the document in the binary field unless **Output Mode** is
**URL Only**.

## Convert Markdown to a document

Use this operation to convert Markdown text to a formatted document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Markdown to Document**.
- **Markdown**: Enter the Markdown text. Headings, bold, italic, inline code,
  bullet and numbered lists, and fenced code blocks are supported.
- The [output parameters](#input-and-output-parameters).

## Update a row in a spreadsheet

Use this operation to find rows in an XLSX spreadsheet and update their
values.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Document Builder**.
- **Operation**: Select **Update Row in Spreadsheet**.
- **File URL**: Enter the URL of the XLSX spreadsheet.
- **Search Column**: Enter the header of the column to search in. The name is
  case-sensitive.
- **Search Value**: Enter the cell value to look for. All matching rows are
  updated.
- **Updates (JSON)**: Enter the new values as an object of column names and
  values, for example, `{ "Status": "Done" }`. Only these columns change.
- The [output parameters](#input-and-output-parameters).

<!-- Definitions -->

[App Node]: ./README.md
[Credentials]: ../credentials/README.md
