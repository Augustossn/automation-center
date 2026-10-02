import { AreaChart } from "../charts/area-chart";
import { Area } from "../charts/area";
import { Grid } from "../charts/grid";
import { XAxis } from "../charts/x-axis";
import { ChartTooltip } from "../charts/tooltip/chart-tooltip";
export function OperationalChart({
  data,
}: {
  data: { date: string; value: number }[];
}) {
  if (!data.length)
    return (
      <p className="empty-table">
        O volume aparecerá quando os primeiros leads entrarem.
      </p>
    );
  return (
    <div
      role="img"
      aria-label="Gráfico de leads recebidos por dia"
      className="operational-chart"
    >
      <AreaChart
        data={data}
        aspectRatio="2.5 / 1"
        animationDuration={250}
        margin={{ top: 20, right: 15, bottom: 32, left: 15 }}
      >
        <Grid horizontal vertical={false} />
        <Area
          dataKey="value"
          fill="#586344"
          stroke="#586344"
          fillOpacity={0.16}
          showMarkers
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
      <span className="muted">
        Total no período: {data.reduce((sum, d) => sum + d.value, 0)} leads
      </span>
    </div>
  );
}
