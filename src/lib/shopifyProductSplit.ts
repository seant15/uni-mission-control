/** Roll up machine vs accessory columns from shopify_daily_performance rows. */

export type ShopifyProductSplitRollup = {
  machineUnits: number
  machineGross: number
  accessoryUnits: number
  accessoryGross: number
}

export function rollupShopifyProductSplit(rows: Array<Record<string, unknown>>): ShopifyProductSplitRollup {
  let machineUnits = 0
  let machineGross = 0
  let accessoryUnits = 0
  let accessoryGross = 0
  for (const row of rows) {
    machineUnits += Number(row.machine_units) || 0
    machineGross += Number(row.machine_gross) || 0
    accessoryUnits += Number(row.accessory_units) || 0
    accessoryGross += Number(row.accessory_gross) || 0
  }
  return { machineUnits, machineGross, accessoryUnits, accessoryGross }
}
