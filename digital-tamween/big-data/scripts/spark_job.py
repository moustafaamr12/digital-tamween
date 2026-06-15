"""
Tamween Analytics — PySpark Batch Job
Submit via:
  docker exec spark-master /opt/spark/bin/spark-submit \
    --packages org.postgresql:postgresql:42.6.0 \
    /opt/spark/work-dir/spark_job.py
"""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

DB_URL   = "jdbc:postgresql://postgres:5432/tamween_db"
DB_PROPS = {"user": "user", "password": "password", "driver": "org.postgresql.Driver"}


def read(spark, table):
    return spark.read.jdbc(url=DB_URL, table=table, properties=DB_PROPS)


def main():
    spark = (
        SparkSession.builder
        .appName("TamweenAnalytics")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    print("=" * 60)
    print("  🚀  TAMWEEN SPARK ANALYTICS JOB")
    print("=" * 60)

    # ── Load tables ───────────────────────────────────────────────────
    purchases      = read(spark, "purchases")
    purchase_items = read(spark, "purchase_items")
    outlets        = read(spark, "outlets")
    users          = read(spark, "users")
    products       = read(spark, "products")
    outlet_products = read(spark, "outlet_products")

    # ── 1. Revenue by outlet ──────────────────────────────────────────
    print("\n📊 Revenue by Outlet:")
    (
        purchases
        .join(outlets, purchases.outletId == outlets.id)
        .groupBy(outlets.name.alias("outlet"))
        .agg(
            F.count("*").alias("transactions"),
            F.round(F.sum("totalAmount"), 2).alias("revenue_EGP"),
            F.round(F.avg("totalAmount"), 2).alias("avg_sale_EGP"),
        )
        .orderBy(F.desc("revenue_EGP"))
        .show(truncate=False)
    )

    # ── 2. Top products by quantity sold ──────────────────────────────
    print("\n🏆 Top Products:")
    (
        purchase_items
        .join(products, purchase_items.productId == products.id)
        .groupBy(products.name.alias("product"), products.unit)
        .agg(
            F.round(F.sum("quantity"), 2).alias("total_qty"),
            F.round(F.sum(purchase_items.quantity * purchase_items.unitPrice), 2).alias("revenue_EGP"),
        )
        .orderBy(F.desc("total_qty"))
        .show(truncate=False)
    )

    # ── 3. User credit utilisation tiers ─────────────────────────────
    print("\n👥 User Credit Utilisation Tiers:")
    (
        users
        .withColumn("pct", (F.col("usedCredit") / F.col("monthlyCredit") * 100).cast("int"))
        .withColumn(
            "tier",
            F.when(F.col("pct") >= 80, "HIGH   (≥80%)")
             .when(F.col("pct") >= 50, "MEDIUM (50-79%)")
             .otherwise(              "LOW    (<50%)")
        )
        .groupBy("tier")
        .agg(F.count("*").alias("users"))
        .orderBy("tier")
        .show(truncate=False)
    )

    # ── 4. Daily sales trend ──────────────────────────────────────────
    print("\n📅 Daily Sales Trend:")
    (
        purchases
        .withColumn("date", F.to_date("createdAt"))
        .groupBy("date")
        .agg(
            F.count("*").alias("transactions"),
            F.round(F.sum("totalAmount"), 2).alias("revenue_EGP"),
        )
        .orderBy("date")
        .show(truncate=False)
    )

    # ── 5. Purchase type split ────────────────────────────────────────
    print("\n🚚 Delivery vs Onsite:")
    (
        purchases
        .groupBy("type")
        .agg(
            F.count("*").alias("count"),
            F.round(F.sum("totalAmount"), 2).alias("revenue_EGP"),
        )
        .show(truncate=False)
    )

    # ── 6. Low-stock items ────────────────────────────────────────────
    print("\n⚠️  Low Stock Items:")
    (
        outlet_products
        .filter(F.col("quantity") <= F.col("minThreshold"))
        .join(outlets,  outlet_products.outletId  == outlets.id)
        .join(products, outlet_products.productId == products.id)
        .select(
            outlets.name.alias("outlet"),
            products.name.alias("product"),
            outlet_products.quantity.alias("qty_left"),
            outlet_products.minThreshold.alias("threshold"),
        )
        .orderBy("outlet", "qty_left")
        .show(truncate=False)
    )

    print("\n✅  Spark analytics job finished.")
    spark.stop()


if __name__ == "__main__":
    main()
