/** Roll up machine vs accessory columns from shopify_daily_performance rows. */

export type ShopifyProductSplitRollup = {
  machineUnits: number
  machineGross: number
  accessoryUnits: number
  accessoryGross: number
  /** Sum of gross_revenue (order total_price — matches Overview Shopify gross KPI). */
  orderGross: number
  /** Sum of product_subtotal when synced; else 0 on legacy rows. */
  productSubtotal: number
  /** Days in range with Shopify order gross > 0. */
  daysWithOrders: number
  /** Days where machine+accessory split was populated (non-zero product lines). */
  daysWithProductSplit: number
}

export function rollupShopifyProductSplit(rows: Array<Record<string, unknown>>): ShopifyProductSplitRollup {
  let machineUnits = 0
  let machineGross = 0
  let accessoryUnits = 0
  let accessoryGross = 0
  let orderGross = 0
  let productSubtotal = 0
  let daysWithOrders = 0
  let daysWithProductSplit = 0

  for (const row of rows) {
    machineUnits += Number(row.machine_units) || 0
    machineGross += Number(row.machine_gross) || 0
    accessoryUnits += Number(row.accessory_units) || 0
    accessoryGross += Number(row.accessory_gross) || 0

    const dayGross = Number(row.gross_revenue) || 0
    const daySubtotal = Number(row.product_subtotal) || 0
    const dayProduct = (Number(row.machine_gross) || 0) + (Number(row.accessory_gross) || 0)

    orderGross += dayGross
    productSubtotal += daySubtotal
    if (dayGross > 0) daysWithOrders += 1
    if (dayProduct > 0) daysWithProductSplit += 1
  }

  return {
    machineUnits,
    machineGross,
    accessoryUnits,
    accessoryGross,
    orderGross,
    productSubtotal,
    daysWithOrders,
    daysWithProductSplit,
  }
}

/** Product line revenue from machine + accessory columns. */
export function productLineGross(rollup: ShopifyProductSplitRollup): number {
  return rollup.machineGross + rollup.accessoryGross
}
