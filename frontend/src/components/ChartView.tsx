import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register required chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  Tooltip,
  Legend
);

interface Props {
  type: string;
  config: { [key: string]: any };
  rows: Array<Record<string, any>>;
}

// ChartView component renders a chart based on the type (bar, line, pie)
// and configuration returned by the backend. The configuration should include
// at minimum the keys 'x' and 'y' to map the data.
export default function ChartView({ type, config, rows }: Props) {
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const xKey = config.x;
    const yKey = config.y;
    const labels = rows.map((r) => String(r[xKey]));
    const dataValues = rows.map((r) => Number(r[yKey]));
    return {
      labels,
      datasets: [
        {
          label: `${yKey} by ${xKey}`,
          data: dataValues,
        }
      ],
    };
  }, [rows, config]);

  if (!chartData) {
    return <p>No chart data available.</p>;
  }
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Chart Result',
      },
    },
  };
  switch (type) {
    case 'bar':
      return <Bar data={chartData} options={options} />;
    case 'line':
      return <Line data={chartData} options={options} />;
    case 'pie':
      return <Pie data={chartData} options={options} />;
    default:
      return <p>Unsupported chart type: {type}</p>;
  }
}