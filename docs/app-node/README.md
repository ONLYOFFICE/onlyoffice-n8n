# ONLYOFFICE Docs node

Use the ONLYOFFICE Docs node to automate document processing with ONLYOFFICE
Document Server, and integrate it with other applications. n8n has built-in
support for converting documents between formats and for building, filling and
extracting data from documents with Document Builder.

On this page, you'll find a list of operations the ONLYOFFICE Docs node
supports and links to more resources.

> [!NOTE]
>
> Refer to [ONLYOFFICE Docs credentials][Credentials] for guidance on setting
> up authentication.

## Operations

- **Conversion**
  - [**Convert a document**](./conversion-operations.md#convert-a-document)
  - [**Convert a document to PDF**](./conversion-operations.md#convert-a-document-to-pdf)
  - [**Generate a thumbnail**](./conversion-operations.md#generate-a-thumbnail)
  - [**Remove a password**](./conversion-operations.md#remove-a-password)
  - [**Convert a spreadsheet to PDF**](./conversion-operations.md#convert-a-spreadsheet-to-pdf)
  - [**Add a watermark**](./conversion-operations.md#add-a-watermark)
- **Document Builder**
  - [**Append content to a document**](./document-builder-operations.md#append-content-to-a-document)
  - [**Append rows to a spreadsheet**](./document-builder-operations.md#append-rows-to-a-spreadsheet)
  - [**Create a document**](./document-builder-operations.md#create-a-document)
  - [**Extract chunks**](./document-builder-operations.md#extract-chunks)
  - [**Extract metadata**](./document-builder-operations.md#extract-metadata)
  - [**Extract an outline**](./document-builder-operations.md#extract-an-outline)
  - [**Extract tables**](./document-builder-operations.md#extract-tables)
  - [**Extract text**](./document-builder-operations.md#extract-text)
  - [**Fill a template**](./document-builder-operations.md#fill-a-template)
  - [**Generate a presentation**](./document-builder-operations.md#generate-a-presentation)
  - [**Generate a spreadsheet**](./document-builder-operations.md#generate-a-spreadsheet)
  - [**Create a table from JSON**](./document-builder-operations.md#create-a-table-from-json)
  - [**Run a mail merge**](./document-builder-operations.md#run-a-mail-merge)
  - [**Convert Markdown to a document**](./document-builder-operations.md#convert-markdown-to-a-document)
  - [**Update a row in a spreadsheet**](./document-builder-operations.md#update-a-row-in-a-spreadsheet)

## Common issues

### The Document Server can't download the file

The Document Server downloads the file from the **File URL** itself, so the
URL must be reachable from the Document Server, not only from n8n. By default
the Document Server refuses to download files from private network addresses
(`services.CoAuthoring.request-filtering-agent.allowPrivateIPAddress` in
`local.json`, or the `ALLOW_PRIVATE_IP_ADDRESS` environment variable in
Docker). A download problem ends with the error code `-4`.

To avoid the download, set **File Source** to **Binary Input** and pass the
file from a previous node (ONLYOFFICE Docs 10.0 or later).

### Conversion failed with error code

The node returns the error code of the Document Server. Refer to [ONLYOFFICE
Docs API: Conversion error codes] for the full list. The most common ones:

- `-4`: The Document Server could not download the source file.
- `-5`: The password is incorrect (**Remove Password** operation).
- `-8`: The token is invalid. Check the **JWT Secret** and **JWT Header** of
  the credentials.

### Document Builder failed with error code

Refer to [ONLYOFFICE Docs API: Document Builder] for the list of error codes.
The Document Builder operations require ONLYOFFICE Docs Developer Edition.

## Related resources

Refer to [ONLYOFFICE Docs API: Conversion API] and [ONLYOFFICE Docs API:
Document Builder] for more information about the service.

<!-- Definitions -->

[ONLYOFFICE Docs API: Conversion API]: https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/
[ONLYOFFICE Docs API: Conversion error codes]: https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/error-codes/
[ONLYOFFICE Docs API: Document Builder]: https://api.onlyoffice.com/docs/docs-api/additional-api/document-builder-api/
[Credentials]: ../credentials/README.md
