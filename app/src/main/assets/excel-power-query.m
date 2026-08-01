// ============================================
// ALPHEX AI SOLUTIONS POS
// Excel Power Query M-Code Script
// ============================================
//
// HOW TO USE:
// 1. Open Excel → Data tab → Get Data → From Other Sources → Blank Query
// 2. Click "Advanced Editor"
// 3. Paste the relevant M-Code below
// 4. Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY
// 5. Click "Done" then "Close & Load"
// 6. Use "Data → Refresh All" to sync latest data
// ============================================

// ============================================
// QUERY 1: ORDERS (Sales History)
// ============================================
/*
let
    SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co",
    SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY",
    
    Source = Json.Document(
        Web.Contents(
            SUPABASE_URL & "/rest/v1/orders?order_type=eq.SALE&order=created_at.desc&select=*,contacts(name)",
            [
                Headers=[
                    #"apikey" = SUPABASE_KEY,
                    #"Authorization" = "Bearer " & SUPABASE_KEY,
                    #"Content-Type" = "application/json"
                ]
            ]
        )
    ),
    
    ToTable = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandColumns = Table.ExpandRecordColumn(ToTable, "Column1", 
        {"id", "order_number", "order_type", "total_amount", "amount_paid", "change_due", 
         "discount", "tax_rate", "tax_amount", "contact_id", "user_id", "payment_method", 
         "status", "notes", "created_at", "contacts"}),
    
    ExpandContacts = Table.ExpandRecordColumn(ExpandColumns, "contacts", {"name"}, {"customer_name"}),
    
    RenameColumns = Table.RenameColumns(ExpandContacts, {
        {"order_number", "Invoice #"},
        {"created_at", "Date"},
        {"total_amount", "Total"},
        {"amount_paid", "Amount Paid"},
        {"change_due", "Change"},
        {"discount", "Discount"},
        {"tax_amount", "Tax"},
        {"payment_method", "Payment"},
        {"status", "Status"},
        {"customer_name", "Customer"}
    }),
    
    SelectColumns = Table.SelectColumns(RenameColumns, 
        {"Invoice #", "Date", "Customer", "Total", "Amount Paid", "Change", "Discount", "Tax", "Payment", "Status"}),
    
    ChangedType = Table.TransformColumnTypes(SelectColumns, {
        {"Total", type number},
        {"Amount Paid", type number},
        {"Change", type number},
        {"Discount", type number},
        {"Tax", type number},
        {"Date", type datetime}
    })
in
    ChangedType
*/

// ============================================
// QUERY 2: ORDER ITEMS (Sales Detail)
// ============================================
/*
let
    SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co",
    SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY",
    
    Source = Json.Document(
        Web.Contents(
            SUPABASE_URL & "/rest/v1/order_items?select=*,orders(order_number,created_at,order_type)&order=orders.created_at.desc",
            [
                Headers=[
                    #"apikey" = SUPABASE_KEY,
                    #"Authorization" = "Bearer " & SUPABASE_KEY,
                    #"Content-Type" = "application/json"
                ]
            ]
        )
    ),
    
    ToTable = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandColumns = Table.ExpandRecordColumn(ToTable, "Column1",
        {"id", "order_id", "product_id", "product_name", "quantity", "unit_price", "cost_price", "subtotal", "orders"}),
    
    ExpandOrders = Table.ExpandRecordColumn(ExpandColumns, "orders", 
        {"order_number", "created_at", "order_type"}, 
        {"invoice_number", "order_date", "order_type"}),
    
    SelectColumns = Table.SelectColumns(ExpandOrders,
        {"invoice_number", "order_date", "order_type", "product_name", "quantity", "unit_price", "cost_price", "subtotal"}),
    
    ChangedType = Table.TransformColumnTypes(SelectColumns, {
        {"quantity", Int64.Type},
        {"unit_price", type number},
        {"cost_price", type number},
        {"subtotal", type number},
        {"order_date", type datetime}
    })
in
    ChangedType
*/

// ============================================
// QUERY 3: PRODUCTS (Inventory)
// ============================================
/*
let
    SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co",
    SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY",
    
    Source = Json.Document(
        Web.Contents(
            SUPABASE_URL & "/rest/v1/products?active=eq.true&order=name",
            [
                Headers=[
                    #"apikey" = SUPABASE_KEY,
                    #"Authorization" = "Bearer " & SUPABASE_KEY,
                    #"Content-Type" = "application/json"
                ]
            ]
        )
    ),
    
    ToTable = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandColumns = Table.ExpandRecordColumn(ToTable, "Column1",
        {"sku", "name", "category", "purchase_price", "sale_price", "stock_quantity", "min_stock"}),
    
    RenameColumns = Table.RenameColumns(ExpandColumns, {
        {"sku", "SKU"},
        {"name", "Product"},
        {"category", "Category"},
        {"purchase_price", "Cost Price"},
        {"sale_price", "Sale Price"},
        {"stock_quantity", "Stock"},
        {"min_stock", "Min Stock"}
    }),
    
    AddedStockStatus = Table.AddColumn(RenameColumns, "Status", each 
        if [Stock] <= 0 then "Out of Stock"
        else if [Stock] <= [Min Stock] then "Low Stock"
        else "In Stock", type text),
    
    AddedStockValue = Table.AddColumn(AddedStockStatus, "Stock Value", each 
        [Stock] * [Cost Price], type number),
    
    ChangedType = Table.TransformColumnTypes(AddedStockValue, {
        {"Cost Price", type number},
        {"Sale Price", type number},
        {"Stock", Int64.Type},
        {"Min Stock", Int64.Type},
        {"Stock Value", type number}
    })
in
    ChangedType
*/

// ============================================
// QUERY 4: DAILY SALES SUMMARY
// ============================================
/*
let
    Orders = YourOrdersQuery,
    
    GroupedByDate = Table.Group(Orders, {"Date"}, {
        {"Total Orders", each Table.RowCount(_), Int64.Type},
        {"Revenue", each List.Sum([Total]), type number},
        {"Avg Order", each List.Average([Total]), type number}
    }),
    
    SortedByDate = Table.Sort(GroupedByDate, {{"Date", Order.Descending}}),
    
    ChangedType = Table.TransformColumnTypes(SortedByDate, {
        {"Date", type date},
        {"Revenue", type number},
        {"Avg Order", type number}
    })
in
    SortedByDate
*/
