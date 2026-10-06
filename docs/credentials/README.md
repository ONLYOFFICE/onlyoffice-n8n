# ONLYOFFICE Docs credentials

You can use these credentials to authenticate the following nodes:

- [ONLYOFFICE Docs][App Node]

## Prerequisites

Install [ONLYOFFICE Docs] or get access to an existing ONLYOFFICE Document
Server with JWT enabled.

- The **Conversion** operations work with any edition of ONLYOFFICE Docs. The
  **Binary Input** file source requires ONLYOFFICE Docs 10.0 or later.
- The **Document Builder** operations require ONLYOFFICE Docs Developer
  Edition, which includes the Document Builder service.

## Supported authentication methods

- [JWT](#using-jwt)

## Using JWT

To configure this credential, you'll need:

- A **Document Server URL** of your ONLYOFFICE Document Server.
- A **JWT Secret** configured on your ONLYOFFICE Document Server.
- A **JWT Header** that your ONLYOFFICE Document Server reads the token from.

### Get the JWT secret of ONLYOFFICE Document Server

1. On the server with ONLYOFFICE Docs, open the configuration file
   `/etc/onlyoffice/documentserver/local.json`.
2. Copy the value of `services.CoAuthoring.secret.inbox.string`.
3. If your Document Server runs in Docker, you can also use the value of the
   `JWT_SECRET` environment variable of the container.

### Configure n8n credentials

1. In your n8n instance, navigate to the credentials form.
2. Enter the **Document Server URL** of your ONLYOFFICE Document Server (for
   example, `https://docs.example.com`).
3. Paste the copied secret into the **JWT Secret** field.
4. Leave the **JWT Header** as `Authorization`, unless your Document Server
   uses another header (`services.CoAuthoring.token.inbox.header` in
   `local.json`, or the `JWT_HEADER` environment variable in Docker).
5. Click the **Save** button to save your credentials.

n8n tests the credentials with a conversion request to the Document Server.

### Related resources

Refer to [ONLYOFFICE Docs API: Signature] and [ONLYOFFICE Docs Help Center:
Configuring JWT] for more information.

<!-- Definitions -->

[ONLYOFFICE Docs API: Signature]: https://api.onlyoffice.com/docs/docs-api/additional-api/signature/
[ONLYOFFICE Docs Help Center: Configuring JWT]: https://helpcenter.onlyoffice.com/docs/installation/docs-configure-jwt.aspx
[ONLYOFFICE Docs]: https://www.onlyoffice.com/docs
[App Node]: ../app-node/README.md
