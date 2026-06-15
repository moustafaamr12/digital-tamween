from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import psycopg2

DB_CONN = {
    'host': 'postgres',
    'port': 5432,
    'database': 'tamween_db',
    'user': 'user',
    'password': 'password',
}

default_args = {
    'owner': 'tamween-bigdata',
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}


def _conn():
    return psycopg2.connect(**DB_CONN)


# ── Task 1: daily sales per outlet ───────────────────────────────────────────
def extract_daily_sales(**context):
    target_date = context['ds']
    conn = _conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            o.name                                              AS outlet_name,
            COUNT(p.id)                                        AS total_transactions,
            COALESCE(SUM(p."totalAmount"), 0)                  AS total_revenue,
            COUNT(CASE WHEN p.type = 'DELIVERY' THEN 1 END)   AS delivery_count,
            COUNT(CASE WHEN p.type = 'ONSITE'   THEN 1 END)   AS onsite_count
        FROM purchases p
        JOIN outlets o ON p."outletId" = o.id
        WHERE DATE(p."createdAt") = %s
        GROUP BY o.id, o.name
        ORDER BY total_revenue DESC
    """, (target_date,))
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    result = [dict(zip(cols, r)) for r in rows]
    conn.close()

    print(f"\n📊 Daily Sales — {target_date}")
    print(f"   Outlets with sales: {len(result)}")
    for r in result:
        print(f"   {r['outlet_name']}: {r['total_transactions']} tx  |  {r['total_revenue']} EGP")

    context['ti'].xcom_push(key='daily_sales', value=result)


# ── Task 2: low-stock scan ────────────────────────────────────────────────────
def check_low_stock(**context):
    conn = _conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            o.name   AS outlet_name,
            pr.name  AS product_name,
            op.quantity,
            op."minThreshold"
        FROM outlet_products op
        JOIN outlets  o  ON op."outletId"  = o.id
        JOIN products pr ON op."productId" = pr.id
        WHERE op.quantity <= op."minThreshold"
        ORDER BY o.name, op.quantity
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    low_stock = [dict(zip(cols, r)) for r in rows]
    conn.close()

    print(f"\n⚠️  Low Stock — {len(low_stock)} items below threshold")
    for item in low_stock:
        print(f"   {item['outlet_name']} | {item['product_name']}: "
              f"{item['quantity']} left (threshold {item['minThreshold']})")

    context['ti'].xcom_push(key='low_stock', value=low_stock)


# ── Task 3: user credit stats ─────────────────────────────────────────────────
def calculate_user_stats(**context):
    conn = _conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*)                                                           AS total_users,
            ROUND(AVG("usedCredit")::numeric, 2)                              AS avg_used,
            ROUND(AVG("monthlyCredit" - "usedCredit")::numeric, 2)            AS avg_remaining,
            COUNT(CASE WHEN "usedCredit" / "monthlyCredit" > 0.8 THEN 1 END) AS high_usage_count,
            ROUND(SUM("usedCredit")::numeric, 2)                              AS total_credit_used
        FROM users
    """)
    row = cur.fetchone()
    cols = [d[0] for d in cur.description]
    stats = {k: str(v) for k, v in zip(cols, row)}
    conn.close()

    print(f"\n👥 User Stats")
    print(f"   Total users      : {stats['total_users']}")
    print(f"   Avg credit used  : {stats['avg_used']} EGP")
    print(f"   Avg remaining    : {stats['avg_remaining']} EGP")
    print(f"   High-usage (>80%): {stats['high_usage_count']} users")

    context['ti'].xcom_push(key='user_stats', value=stats)


# ── Task 4: product popularity ────────────────────────────────────────────────
def calculate_product_popularity(**context):
    target_date = context['ds']
    conn = _conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            pr.name                                         AS product_name,
            pr.unit,
            pr.category,
            COALESCE(SUM(pi.quantity), 0)                  AS total_sold,
            COUNT(DISTINCT pi."purchaseId")                AS purchase_count,
            COALESCE(SUM(pi.quantity * pi."unitPrice"), 0) AS revenue
        FROM purchase_items pi
        JOIN products  pr ON pi."productId"  = pr.id
        JOIN purchases p  ON pi."purchaseId" = p.id
        WHERE DATE(p."createdAt") <= %s
        GROUP BY pr.name, pr.unit, pr.category
        ORDER BY total_sold DESC
    """, (target_date,))
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    popularity = [dict(zip(cols, r)) for r in rows]
    conn.close()

    print(f"\n🏆 Product Popularity (cumulative to {target_date})")
    for p in popularity:
        print(f"   {p['product_name']}: {p['total_sold']} {p['unit']} sold  |  {p['revenue']} EGP")

    context['ti'].xcom_push(key='product_popularity', value=popularity)


# ── Task 5: summary report ────────────────────────────────────────────────────
def generate_summary_report(**context):
    ti = context['ti']
    daily_sales       = ti.xcom_pull(key='daily_sales',        task_ids='extract_daily_sales')        or []
    low_stock         = ti.xcom_pull(key='low_stock',          task_ids='check_low_stock')            or []
    user_stats        = ti.xcom_pull(key='user_stats',         task_ids='calculate_user_stats')       or {}
    product_popularity = ti.xcom_pull(key='product_popularity', task_ids='calculate_product_popularity') or []

    target_date        = context['ds']
    total_revenue      = sum(float(s.get('total_revenue') or 0) for s in daily_sales)
    total_transactions = sum(int(s.get('total_transactions') or 0) for s in daily_sales)

    print("\n" + "=" * 60)
    print(f"  📋  TAMWEEN DAILY REPORT — {target_date}")
    print("=" * 60)
    print(f"  💰  Revenue today        : {total_revenue:.2f} EGP")
    print(f"  🛒  Transactions         : {total_transactions}")
    print(f"  🏪  Active outlets       : {len(daily_sales)}")
    print(f"  ⚠️   Low-stock items      : {len(low_stock)}")
    print(f"  👥  Total users          : {user_stats.get('total_users', 'N/A')}")
    top = product_popularity[0]['product_name'] if product_popularity else 'N/A'
    print(f"  📦  Top product          : {top}")
    print("=" * 60)

    if low_stock:
        print("\n🚨 Restock needed:")
        for item in low_stock[:5]:
            print(f"   • {item['outlet_name']} — {item['product_name']}: "
                  f"only {item['quantity']} remaining")


# ── DAG definition ────────────────────────────────────────────────────────────
with DAG(
    dag_id='tamween_daily_analytics',
    default_args=default_args,
    description='Daily analytics pipeline for Digital Tamween',
    schedule='0 1 * * *',   # 01:00 AM every day
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['tamween', 'analytics', 'daily'],
) as dag:

    t_sales   = PythonOperator(task_id='extract_daily_sales',        python_callable=extract_daily_sales)
    t_stock   = PythonOperator(task_id='check_low_stock',            python_callable=check_low_stock)
    t_users   = PythonOperator(task_id='calculate_user_stats',       python_callable=calculate_user_stats)
    t_products = PythonOperator(task_id='calculate_product_popularity', python_callable=calculate_product_popularity)
    t_report  = PythonOperator(task_id='generate_summary_report',    python_callable=generate_summary_report)

    # tasks 1-4 run in parallel → then summary
    [t_sales, t_stock, t_users, t_products] >> t_report
