# ONLYOFFICE Docs Conversion operations

Use these operations to convert documents with ONLYOFFICE Document Server.
Refer to [ONLYOFFICE Docs][App Node] for more information on the ONLYOFFICE
Docs node itself.

## Source and output parameters

Every Conversion operation takes these parameters:

- **File Source**: Select where to get the source file from.
  - Select **URL** to let the Document Server download the file from a URL.
  - Select **Binary Input** to send a file from a binary field of a previous
    node. Requires ONLYOFFICE Docs 10.0 or later.
- **File URL**: Enter the URL of the source file. The URL must be reachable
  from the Document Server. Shown when **File Source** is **URL**.
- **Input Binary Field**: Enter the name of the binary field with the source
  file. Shown when **File Source** is **Binary Input**.
- **Input Format Name or ID**: Select the format of the source file. The list
  contains only the formats the operation can convert.
- **Output Mode**: Select how to return the result.
  - Select **File Data** to download the converted file and return it as
    binary data.
  - Select **URL Only** to return only the URL of the converted file on the
    Document Server. The URL is temporary.
- **Output File Name**: Enter the name of the output file without an
  extension. The node adds the extension of the output format.
- **Put Output File in Field**: Enter the field name to place the binary file
  contents to make it available to following nodes.

The output item contains `success`, `fileName`, `inputFormat`, `outputFormat`,
`operation` and, for the **URL** file source, `convertedUrl`. With **URL Only**
it contains `success`, `convertedUrl`, `inputFormat`, `outputFormat` and
`operation`.

## Convert a document

Use this operation to convert a document from one format to another.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Convert Document**.
- The [source and output parameters](#source-and-output-parameters).
- **Output Format Name or ID**: Select the format to convert the document to.
  The list contains the formats the selected input format can be converted to.

## Convert a document to PDF

Use this operation to convert a document, a spreadsheet or a presentation to
PDF.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Convert to PDF**.
- The [source and output parameters](#source-and-output-parameters).

## Generate a thumbnail

Use this operation to generate a thumbnail image of a document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Generate Thumbnail**.
- The [source and output parameters](#source-and-output-parameters).
- **Image Format**: Select **PNG** or **JPG**.
- **Width**: Enter the thumbnail width in pixels.
- **Height**: Enter the thumbnail height in pixels.
- **Aspect Ratio**: Select how to fit the page into the thumbnail size.
  - Select **Fit** to keep the aspect ratio and fit the page into the size.
  - Select **Crop** to keep the aspect ratio and crop the page to the size.
  - Select **Stretch** to stretch the page to the size.
- **First Page Only**: Toggle to generate a thumbnail of the first page only.
  When toggled off, the output is a ZIP archive with an image of every page.

## Remove a password

Use this operation to remove the password protection from a document.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Remove Password**.
- The [source and output parameters](#source-and-output-parameters).
- **Output Format Name or ID**: Select the format of the unprotected document.
- **Password**: Enter the password of the protected document. A wrong password
  ends with the error code `-5`.

## Convert a spreadsheet to PDF

Use this operation to convert a spreadsheet to PDF with page layout options.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Spreadsheet to PDF**.
- The [source and output parameters](#source-and-output-parameters).
- **Orientation**: Select **Portrait** or **Landscape**.

### Options

Add these options in **Spreadsheet Options**:

- **Fit to Height (Pages)**: Enter the number of pages to fit the height to.
  `0` means automatic.
- **Fit to Width (Pages)**: Enter the number of pages to fit the width to. `0`
  means automatic.
- **Ignore Print Area**: Toggle to ignore the print area set in the
  spreadsheet.
- **Margin Bottom**, **Margin Left**, **Margin Right**, **Margin Top**: Enter
  the page margins, for example, `19.1mm`.
- **Page Height**, **Page Width**: Enter the page size, for example, `297mm`
  and `210mm` for A4.
- **Scale (%)**: Enter the zoom scale from 10 to 400.
- **Show Grid Lines**: Toggle to show the grid lines in the PDF.
- **Show Headings**: Toggle to show the row and column headings in the PDF.

## Add a watermark

Use this operation to convert a document to PDF with a text watermark.

Enter these parameters:

- **Credential to connect with**: Create or select an existing [ONLYOFFICE Docs
  credentials][Credentials].
- **Resource**: Select **Conversion**.
- **Operation**: Select **Watermark**.
- The [source and output parameters](#source-and-output-parameters).
- **Watermark Text**: Enter the text of the watermark.

### Options

Add these options in **Watermark Options**:

- **Bold**: Toggle to make the watermark text bold.
- **Diagonal**: Toggle to place the watermark diagonally.
- **Font Color**: Select the color of the watermark text.
- **Font Size**: Enter the font size of the watermark text.
- **Opacity**: Enter the opacity of the watermark from `0` (fully transparent)
  to `1` (fully opaque).

<!-- Definitions -->

[App Node]: ./README.md
[Credentials]: ../credentials/README.md
