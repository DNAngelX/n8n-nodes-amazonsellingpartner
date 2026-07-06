# n8n-nodes-amazon-selling-partner-marketplace

Community node for the Amazon Selling Partner API (SP-API).

## Installation

Follow the n8n community nodes installation guide:
https://docs.n8n.io/integrations/community-nodes/installation/

## Credentials

Create your SP-API application in Seller Central:
https://sellercentral.amazon.de/sellingpartner/developerconsole

You will need:
- Application ID
- LWA Client ID
- LWA Client Secret
- LWA Refresh Token (from app authorization)
- AWS Access Key ID
- AWS Secret Access Key
- Primary Marketplace (must match your app authorization)
- AWS Region (must match your marketplace)

Note:
- Seller ID is optional. If provided, it is used directly. If missing, the node tries to auto-detect via marketplace participations.
- LWA access tokens are refreshed automatically.
- If Marketplace/Region do not match, Amazon returns 401/403.

## Supported Resources (current)

Amazon Warehousing And Distribution, Aplus Content, Application Integrations, Application Management, Catalog Items, Customer Feedback, Data Kiosk, Delivery By Amazon, Easy Ship, External Fulfillment, Fba Inbound Eligibility, Fba Inventory, Feeds, Finances, Fulfillment Inbound, Fulfillment Outbound, Invoices, Listings Items, Listings Restrictions, Merchant Fulfillment, Messaging, Notifications, Orders, Product Fees, Product Pricing, Product Type Definitions, Replenishment, Reports, Sales, Seller Wallet, Sellers, Services, Shipment Invoicing, Shipping, Solicitations, Supply Sources, Tokens, Uploads, Vehicles, Vendor Direct Fulfillment Inventory, Vendor Direct Fulfillment Orders, Vendor Direct Fulfillment Payments, Vendor Direct Fulfillment Sandbox Test Data, Vendor Direct Fulfillment Shipping, Vendor Direct Fulfillment Transactions, Vendor Invoices, Vendor Orders, Vendor Shipments, Vendor Transaction Status.

## Custom API Call

Use the Custom resource when you need an endpoint that is not mapped yet or when you want full control.

Custom Request supports:
- Method
- Endpoint (path or full URL)
- Query (JSON)
- Body (JSON)
- Headers (JSON)
- Response type (json or text)
- Include response metadata

You can also use "Request via JSON Definition" to submit a full request object (or an array of requests).

### Example 1: Catalog Items search (Custom Request)

- Resource: Custom
- Operation: Custom Request
- Method: GET
- Endpoint: /catalog/2022-04-01/items
- Query (JSON):

```json
{
  "marketplaceIds": ["A1PA6795UKMFR9"],
  "keywords": ["keyboard"],
  "includedData": ["summaries"],
  "pageSize": 10
}
```

### Example 2: Listings Items get (Custom Request)

Replace the placeholders with your sellerId and SKU.

- Resource: Custom
- Operation: Custom Request
- Method: GET
- Endpoint: /listings/2021-08-01/items/SELLER_ID/SKU
- Query (JSON):

```json
{
  "marketplaceIds": ["A1PA6795UKMFR9"],
  "includedData": ["summaries"],
  "issueLocale": "de_DE"
}
```

### Example 3: JSON Definition (single request)

- Resource: Custom
- Operation: Request via JSON Definition
- Request Definition (JSON):

```json
{
  "method": "GET",
  "endpoint": "/catalog/2022-04-01/items",
  "query": {
    "marketplaceIds": ["A1PA6795UKMFR9"],
    "keywords": ["headphones"],
    "includedData": ["summaries"],
    "pageSize": 5
  },
  "responseType": "json",
  "includeMetadata": false
}
```

### Example 4: JSON Definition (PATCH Listings Item)

- Resource: Custom
- Operation: Request via JSON Definition
- Request Definition (JSON):

```json
{
  "method": "PATCH",
  "endpoint": "/listings/2021-08-01/items/SELLER_ID/SKU",
  "query": {
    "marketplaceIds": ["A1PA6795UKMFR9"],
    "issueLocale": "de_DE"
  },
  "body": {
    "productType": "PRODUCT",
    "patches": [
      {
        "op": "replace",
        "path": "/attributes/item_name",
        "value": [
          {
            "value": "Neuer Produkttitel",
            "languageTag": "de_DE"
          }
        ]
      }
    ]
  },
  "responseType": "json",
  "includeMetadata": false
}
```

## Resources

- SP-API Reference: https://developer-docs.amazon.com/sp-api/reference/welcome-to-api-references
- SP-API Setup: https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
