docker start oracle_21c_xe
# استهلاك الذاكرة والمعالج الحالي
docker stats oracle_21c_xe

# أو لكل الحاويات النشطة (Oracle ستكون واضحة)
docker stats


# مراقبة حية مع تحديث كل ثانية
docker stats oracle_21c_xe

# أعلى العمليات داخل Oracle
docker top oracle_21c_xe

# إحصائيات كاملة (CPU per core, memory details)
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}" oracle_21c_xe
