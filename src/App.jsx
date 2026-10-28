
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";

const TOPOLOGIES = ["Star", "Bus", "Ring", "Mesh", "Hybrid"];

function buildNetwork(topology, count = 6) {
  const nodes = [];
  const edges = [];

  for (let i = 0; i < count; i++) {
    let x;
    let y;
    let kind = "pc";
    let label = `PC-${i + 1}`;

    if (topology === "Bus") {
      x = 100 + i * 150;
      y = 260;
    } else if (topology === "Star" && i === 0) {
      x = 400;
      y = 260;
      kind = "switch";
      label = "Switch-1";
    } else {
      const index = topology === "Star" ? i - 1 : i;
      const total = topology === "Star" ? count - 1 : count;
      const angle = (2 * Math.PI * index) / total - Math.PI / 2;

      x = 400 + 250 * Math.cos(angle);
      y = 260 + 170 * Math.sin(angle);
    }

    nodes.push({
      id: `n${i}`,
      type: "device",
      position: { x, y },
      data: { label, kind, failed: false },
    });
  }

  const link = (a, b) => {
    if (a === b) return;

    const source = `n${a}`;
    const target = `n${b}`;

    if (
      edges.some(
        (edge) =>
          (edge.source === source && edge.target === target) ||
          (edge.source === target && edge.target === source)
      )
    ) return;

    edges.push({
      id: `e${a}-${b}`,
      source,
      target,
      type: "straight",
      data: { failed: false },
      style: { stroke: "#62788c", strokeWidth: 2.5 },
    });
  };

  if (topology === "Star") {
    for (let i = 1; i < count; i++) link(0, i);
  } else if (topology === "Bus") {
    for (let i = 0; i < count - 1; i++) link(i, i + 1);
  } else if (topology === "Ring") {
    for (let i = 0; i < count; i++) link(i, (i + 1) % count);
  } else if (topology === "Mesh") {
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) link(i, j);
    }
  } else {
    const middle = Math.floor(count / 2);

    for (let i = 1; i < middle; i++) link(0, i);
    for (let i = middle + 1; i < count; i++) link(middle, i);

    link(0, middle);
    if (middle > 1) link(1, middle);
    if (count - middle > 2) link(middle - 1, middle + 1);
  }

  return { nodes, edges };
}

function DeviceNode({ id, data, selected }) {
  const drawings = {
    pc: (
      <svg viewBox="0 0 64 54" aria-hidden="true">
        <rect x="5" y="4" width="54" height="35" rx="3" fill="#b8cad8" stroke="#526c81" strokeWidth="2" />
        <rect x="9" y="8" width="46" height="27" fill="#e9f6ff" />
        <path d="M32 39V47M21 48H43" stroke="#647b8d" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 14H43M14 19H35" stroke="#a4c5df" strokeWidth="2" />
      </svg>
    ),
    switch: (
      <svg viewBox="0 0 64 54" aria-hidden="true">
        <path d="M5 15L32 3L59 15L32 28Z" fill="#c4d1dc" stroke="#526b80" strokeWidth="1.5" />
        <path d="M5 15V35L32 49V28Z" fill="#8298aa" stroke="#526b80" strokeWidth="1.5" />
        <path d="M32 28L59 15V35L32 49Z" fill="#a4b5c4" stroke="#526b80" strokeWidth="1.5" />
        {[18, 26, 34, 42].map((x) => (
          <circle key={x} cx={x} cy="17" r="2" fill="#24a148" />
        ))}
      </svg>
    ),
    router: (
      <svg viewBox="0 0 64 54" aria-hidden="true">
        <rect x="5" y="7" width="54" height="40" rx="7" fill="#dce8f0" stroke="#58748b" strokeWidth="2" />
        <path d="M14 19H47M40 13L47 19L40 25M49 35H16M23 29L16 35L23 41" fill="none" stroke="#3179ad" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    server: (
      <svg viewBox="0 0 64 54" aria-hidden="true">
        <rect x="13" y="3" width="38" height="48" rx="4" fill="#c7d4df" stroke="#5c7387" strokeWidth="2" />
        {[10, 24, 38].map((y) => (
          <g key={y}>
            <rect x="18" y={y - 5} width="28" height="10" rx="2" fill="#859bad" />
            <circle cx="40" cy={y} r="2" fill="#42cf70" />
          </g>
        ))}
      </svg>
    ),
    cloud: (
      <svg viewBox="0 0 64 54" aria-hidden="true">
        <path d="M15 43C1 43 2 26 14 22C14 7 32 3 41 16C57 11 65 31 52 40C48 44 43 43 39 43Z" fill="#f7fbff" stroke="#7e94a6" strokeWidth="2" />
      </svg>
    ),
  };

  return (
    <div className={`device-node ${data.failed ? "device-down" : ""} ${selected ? "device-selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} id="left" />

      <div className="device-art">{drawings[data.kind] || drawings.pc}</div>
      <strong className="device-label">{data.label}</strong>
      <span className="device-status">
        {data.failed ? "FAILED" : data.kind.toUpperCase()}
      </span>

      <button
        className="device-fault-button"
        title={data.failed ? "Restore device" : "Fail device"}
        onClick={(event) => {
          event.stopPropagation();
          data.onToggle?.(id);
        }}
      >
        {data.failed ? "!" : "●"}
      </button>

      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

function getAllRoutes(nodes, edges, source, destination) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const start = nodeMap.get(source);
  const end = nodeMap.get(destination);

  if (!start || !end || start.data.failed || end.data.failed) return [];
  if (source === destination) return [[source]];

  const routes = [];
  const maxRoutes = 100;

  function visit(current, path, visited) {
    if (routes.length >= maxRoutes) return;

    if (current === destination) {
      routes.push(path);
      return;
    }

    for (const edge of edges) {
      if (edge.data?.failed) continue;

      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);

      if (!a || !b || a.data.failed || b.data.failed) continue;

      const next =
        edge.source === current
          ? edge.target
          : edge.target === current
            ? edge.source
            : null;

      if (!next || visited.has(next)) continue;

      const nextVisited = new Set(visited);
      nextVisited.add(next);

      visit(next, [...path, next], nextVisited);

      if (routes.length >= maxRoutes) break;
    }
  }

  visit(source, [source], new Set([source]));
  return routes;
}


// Reliability model assumptions used for an educational estimate.
// Active nodes are assumed to be available with 99% probability and active links
// with 98% probability. Explicitly failed components remain unavailable.
const NODE_AVAILABILITY = 0.99;
const LINK_AVAILABILITY = 0.98;
const RELIABILITY_TRIALS = 1000;

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function estimateNetworkReliability(nodes, edges, source, destination) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const sourceNode = nodeMap.get(source);
  const destinationNode = nodeMap.get(destination);

  if (!sourceNode || !destinationNode || sourceNode.data.failed || destinationNode.data.failed) {
    return 0;
  }

  // Use a stable seed so the displayed estimate does not change randomly on each render.
  const signature = [
    source,
    destination,
    ...nodes.map((node) => `${node.id}:${node.data?.failed ? 1 : 0}`),
    ...edges.map((edge) => `${edge.id}:${edge.source}>${edge.target}:${edge.data?.failed ? 1 : 0}`),
  ].join("|");
  let seed = 2166136261;
  for (let i = 0; i < signature.length; i += 1) {
    seed = Math.imul(seed ^ signature.charCodeAt(i), 16777619);
  }
  const random = createSeededRandom(seed || 1);
  let successfulTrials = 0;

  for (let trial = 0; trial < RELIABILITY_TRIALS; trial += 1) {
    const liveNodes = new Set();
    for (const node of nodes) {
      if (!node.data?.failed && random() < NODE_AVAILABILITY) {
        liveNodes.add(node.id);
      }
    }

    if (!liveNodes.has(source) || !liveNodes.has(destination)) continue;

    const adjacency = new Map(
      [...liveNodes].map((id) => [id, []])
    );

    for (const edge of edges) {
      if (edge.data?.failed) continue;
      if (random() >= LINK_AVAILABILITY) continue;
      if (!liveNodes.has(edge.source) || !liveNodes.has(edge.target)) continue;
      adjacency.get(edge.source).push(edge.target);
      adjacency.get(edge.target).push(edge.source);
    }

    const visited = new Set([source]);
    const queue = [source];
    let found = source === destination;

    for (let index = 0; index < queue.length && !found; index += 1) {
      const current = queue[index];
      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        if (next === destination) {
          found = true;
          break;
        }
        visited.add(next);
        queue.push(next);
      }
    }

    if (found) successfulTrials += 1;
  }

  return Math.round((successfulTrials / RELIABILITY_TRIALS) * 100);
}

function Blueprint({ nodes, edges }) {
  const width = 220;
  const height = 112;
  const pad = 14;

  const positions = useMemo(() => {
    if (!nodes.length) return {};

    const xs = nodes.map((node) => node.position.x);
    const ys = nodes.map((node) => node.position.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return Object.fromEntries(
      nodes.map((node) => [
        node.id,
        {
          x: pad + (maxX === minX ? 0.5 : (node.position.x - minX) / (maxX - minX)) * (width - pad * 2),
          y: pad + (maxY === minY ? 0.5 : (node.position.y - minY) / (maxY - minY)) * (height - pad * 2),
        },
      ])
    );
  }, [nodes]);

  return (
    <svg className="blueprint-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Network blueprint">
      {edges.map((edge) => {
        const a = positions[edge.source];
        const b = positions[edge.target];
        if (!a || !b) return null;

        const nodeA = nodes.find((node) => node.id === edge.source);
        const nodeB = nodes.find((node) => node.id === edge.target);
        const failed = edge.data?.failed || nodeA?.data.failed || nodeB?.data.failed;

        return (
          <line
            key={edge.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={failed ? "#dc3838" : "#8ba0b4"}
            strokeWidth="1.5"
            strokeDasharray={edge.data?.failed ? "4 3" : undefined}
          />
        );
      })}

      {nodes.map((node) => {
        const point = positions[node.id];
        if (!point) return null;

        return (
          <rect
            key={node.id}
            x={point.x - 4}
            y={point.y - 4}
            width="8"
            height="8"
            rx="2"
            fill={node.data.failed ? "#dc3838" : "#3985b8"}
            stroke="#fff"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

export default function App() {
  const initial = useMemo(() => buildNetwork("Star"), []);

  const [topology, setTopology] = useState("Star");
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [faultMode, setFaultMode] = useState(false);
  const [source, setSource] = useState("n1");
  const [destination, setDestination] = useState("n2");
  const [nextId, setNextId] = useState(6);
  const [lastRecovery, setLastRecovery] = useState("");

  const toggleNode = useCallback((id) => {
    const target = nodes.find((node) => node.id === id);
    if (target?.data.failed) {
      setLastRecovery(`Restored ${target.data.label}`);
    } else {
      setLastRecovery("");
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, failed: !node.data.failed } }
          : node
      )
    );
  }, [nodes, setNodes]);

  const toggleEdge = useCallback((id) => {
    const target = edges.find((edge) => edge.id === id);
    if (target?.data?.failed) {
      const from = nodes.find((node) => node.id === target.source)?.data.label || target.source;
      const to = nodes.find((node) => node.id === target.target)?.data.label || target.target;
      setLastRecovery(`Restored link ${from} – ${to}`);
    } else {
      setLastRecovery("");
    }

    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== id) return edge;

        const failed = !edge.data?.failed;

        return {
          ...edge,
          data: { ...edge.data, failed },
          style: {
            stroke: failed ? "#dc3838" : "#62788c",
            strokeWidth: failed ? 3 : 2.5,
            strokeDasharray: failed ? "7 4" : undefined,
          },
        };
      })
    );
  }, [edges, nodes, setEdges]);

  const restoreNode = useCallback((id) => {
    const target = nodes.find((node) => node.id === id);
    if (!target?.data.failed) return;

    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, failed: false } }
          : node
      )
    );
    setLastRecovery(`Restored ${target.data.label}`);
  }, [nodes, setNodes]);

  const restoreEdge = useCallback((id) => {
    const target = edges.find((edge) => edge.id === id);
    if (!target?.data?.failed) return;

    const from = nodes.find((node) => node.id === target.source)?.data.label || target.source;
    const to = nodes.find((node) => node.id === target.target)?.data.label || target.target;

    setEdges((current) =>
      current.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              data: { ...edge.data, failed: false },
              style: { stroke: "#62788c", strokeWidth: 2.5 },
            }
          : edge
      )
    );
    setLastRecovery(`Restored link ${from} – ${to}`);
  }, [edges, nodes, setEdges]);

  const restoreAll = useCallback(() => {
    const failedNodeCount = nodes.filter((node) => node.data.failed).length;
    const failedEdgeCount = edges.filter((edge) => edge.data?.failed).length;
    const total = failedNodeCount + failedEdgeCount;
    if (!total) return;

    setNodes((current) =>
      current.map((node) =>
        node.data.failed
          ? { ...node, data: { ...node.data, failed: false } }
          : node
      )
    );
    setEdges((current) =>
      current.map((edge) =>
        edge.data?.failed
          ? {
              ...edge,
              data: { ...edge.data, failed: false },
              style: { stroke: "#62788c", strokeWidth: 2.5 },
            }
          : edge
      )
    );
    setLastRecovery(`Restored ${total} component${total === 1 ? "" : "s"}`);
  }, [nodes, edges, setNodes, setEdges]);

  const visibleNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      data: { ...node.data, onToggle: toggleNode },
    })),
    [nodes, toggleNode]
  );

  const onConnect = useCallback((connection) => {
    setEdges((current) =>
      addEdge({
        ...connection,
        id: `link-${Date.now()}`,
        type: "straight",
        data: { failed: false },
        style: { stroke: "#62788c", strokeWidth: 2.5 },
      }, current)
    );
    setTopology("Custom");
  }, [setEdges]);

  const onDragStart = (event, kind) => {
    event.dataTransfer.setData("application/network-device", kind);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const kind = event.dataTransfer.getData("application/network-device");
    if (!kind) return;

    const canvas = event.currentTarget.querySelector(".flow-wrap");
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const labels = {
      pc: `PC-${nextId + 1}`,
      switch: `Switch-${nextId - 5}`,
      router: `Router-${nextId - 5}`,
      server: `Server-${nextId - 5}`,
      cloud: `Cloud-${nextId - 5}`,
    };

    setNodes((current) => [
      ...current,
      {
        id: `n${nextId}`,
        type: "device",
        position: {
          x: event.clientX - bounds.left - 55,
          y: event.clientY - bounds.top - 45,
        },
        data: { label: labels[kind], kind, failed: false },
      },
    ]);

    setNextId((value) => value + 1);
    setTopology("Custom");
  }, [nextId, setNodes]);

  const selectTopology = (name) => {
    const network = buildNetwork(name);

    setTopology(name);
    setNodes(network.nodes);
    setEdges(network.edges);
    setSource(name === "Star" ? "n1" : "n0");
    setDestination("n2");
    setNextId(6);
    setFaultMode(false);
    setLastRecovery("");
  };

  const resetNetwork = () => selectTopology(topology === "Custom" ? "Star" : topology);

  const routes = useMemo(
    () => getAllRoutes(nodes, edges, source, destination),
    [nodes, edges, source, destination]
  );

  const activeNodes = nodes.filter((node) => !node.data.failed);

  const reachable = activeNodes.filter(
    (node) => getAllRoutes(nodes, edges, source, node.id).length > 0
  ).length;

  const reachability = activeNodes.length
    ? Math.round((reachable / activeNodes.length) * 100)
    : 0;

  const connected = activeNodes.length > 0 && reachable === activeNodes.length;

  const failedNodes = nodes.filter((node) => node.data.failed);
  // Only explicitly failed links are listed as recoverable link faults. Links attached
  // to failed nodes are blocked automatically and become usable when the node is restored.
  const failedEdges = edges.filter((edge) => edge.data?.failed);
  const reliability = useMemo(
    () => estimateNetworkReliability(nodes, edges, source, destination),
    [nodes, edges, source, destination]
  );
  const recoveryStatus =
    failedNodes.length || failedEdges.length
      ? "Fault Detected"
      : lastRecovery
        ? "Recovered"
        : "Normal";

  const routeText = (route) =>
    route.map((id) => nodes.find((node) => node.id === id)?.data.label || id).join(" → ");

  return (
    <main className="editor">
      <header className="topbar">
        <div className="top-brand">
          <div className="brand-mark">T</div>
          <div>
            <strong>TopologyLab</strong>
            <small>Network topology studio</small>
          </div>
        </div>

        <nav className="topology-tabs">
          {TOPOLOGIES.map((name) => (
            <button
              key={name}
              className={topology === name ? "top-tab active" : "top-tab"}
              onClick={() => selectTopology(name)}
            >
              {name}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <button
            className={faultMode ? "fault-toggle active-fault" : "fault-toggle"}
            onClick={() => setFaultMode((value) => !value)}
          >
            ⚡ {faultMode ? "Fault ON" : "Fault mode"}
          </button>
          <button className="reset-button" onClick={resetNetwork}>↻ Reset</button>
        </div>
      </header>

      <section className="editor-body">
        <aside className="elements-panel">
          <h3>Devices</h3>
          <p className="panel-help">Drag onto the canvas.</p>

          {[
            { kind: "pc", icon: "▣", title: "PC" },
            { kind: "switch", icon: "⇄", title: "Switch" },
            { kind: "router", icon: "↔", title: "Router" },
            { kind: "server", icon: "▤", title: "Server" },
            { kind: "cloud", icon: "☁", title: "Cloud" },
          ].map((item) => (
            <div
              key={item.kind}
              className="palette-item"
              draggable
              onDragStart={(event) => onDragStart(event, item.kind)}
            >
              <div className="palette-icon">{item.icon}</div>
              <strong>{item.title}</strong>
              <span className="drag-grip">⠿</span>
            </div>
          ))}

          <div className="panel-divider" />
          <h3>Network Analysis</h3>

          <div className="tool-note">
            <span>↔</span>
            <div><strong>Connectivity</strong><small>Check connected devices and paths.</small></div>
          </div>

          <div className="tool-note">
            <span>⚡</span>
            <div><strong>Fault Tolerance</strong><small>Test node and link failures.</small></div>
          </div>

          <div className="panel-bottom"><span className="green-dot" />Ready</div>
        </aside>

        <section
          className="canvas-area"
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <div className="canvas-heading">
            <strong>{topology === "Custom" ? "Custom topology" : `${topology} topology`}</strong>
            <span className="canvas-status">● Workspace</span>
          </div>

          <div className="flow-wrap">
            <ReactFlow
              nodes={visibleNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                if (faultMode) toggleNode(node.id);
              }}
              onEdgeClick={(_, edge) => {
                if (faultMode) toggleEdge(edge.id);
              }}
              nodesConnectable
              nodesDraggable
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1.15 }}
              minZoom={0.15}
              maxZoom={2}
              deleteKeyCode={["Backspace", "Delete"]}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#dce3e9" gap={22} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>

          <div className="canvas-foot">
            <span>{nodes.length} nodes · {edges.length} links</span>
            <span>{faultMode ? "Click a node or link to toggle failure" : "Drag · Connect · Zoom"}</span>
          </div>
        </section>
      </section>

      <footer className="results-panel">
        <section className="dash-section reach-section">
          <h4>Network Metrics</h4>

          <div className="metric-line">
            <span>Reachability</span>
            <strong>{reachability}%</strong>
          </div>

          <div className="metric-line">
            <span>Connectivity</span>
            <strong className={connected ? "text-good" : "text-bad"}>
              {connected ? "Connected" : "Disconnected"}
            </strong>
          </div>

          <div className="metric-line" title="Estimated with 1,000 simulations: active nodes 99% availability and active links 98% availability.">
            <span>Reliability</span>
            <strong className={reliability >= 80 ? "text-good" : "text-bad"}>~{reliability}%</strong>
          </div>

          <div className="metric-line">
            <span>Recovery</span>
            <strong className={
              recoveryStatus === "Fault Detected"
                ? "text-bad"
                : recoveryStatus === "Recovered"
                  ? "text-good"
                  : "recovery-normal"
            }>
              {recoveryStatus}
            </strong>
          </div>
          <p className="metric-note">Estimate assumes 99% node / 98% link availability.</p>
        </section>

        <section className="dash-section endpoint-section">
          <h4>Source</h4>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.data.label}{node.data.failed ? " (failed)" : ""}
              </option>
            ))}
          </select>

          <h4 className="destination-heading">Destination</h4>
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.data.label}{node.data.failed ? " (failed)" : ""}
              </option>
            ))}
          </select>
        </section>

        <section className="dash-section routes-section">
          <div className="dash-heading">
            <h4>Available Routes</h4>
            <span>{routes.length}{routes.length >= 100 ? "+" : ""}</span>
          </div>

          <div className="route-list">
            {routes.length ? routes.map((route, index) => (
              <div className="route-item" key={`${index}-${route.join("-")}`}>
                <span>{index + 1}</span>
                <span>{routeText(route)}</span>
              </div>
            )) : <p className="empty-state">No available route</p>}
          </div>
        </section>

        <section className="dash-section recovery-section">
          <div className="dash-heading">
            <h4>Recovery Matrix</h4>
            <span className={failedNodes.length || failedEdges.length ? "failure-count" : "recovery-count"}>
              {failedNodes.length + failedEdges.length} issues
            </span>
          </div>

          <div className="recovery-summary">
            <span className={`recovery-status-badge ${
              recoveryStatus === "Fault Detected"
                ? "status-fault"
                : recoveryStatus === "Recovered"
                  ? "status-recovered"
                  : "status-normal"
            }`}>
              {recoveryStatus}
            </span>
            {(failedNodes.length > 0 || failedEdges.length > 0) && (
              <button className="restore-all-button" onClick={restoreAll}>
                Restore all
              </button>
            )}
          </div>

          <div className="recovery-list">
            {failedNodes.map((node) => (
              <div className="recovery-item" key={`node-${node.id}`}>
                <div className="recovery-item-info">
                  <b className="recovery-kind node-kind">NODE</b>
                  <span>{node.data.label}</span>
                  <small>Failed</small>
                </div>
                <button className="restore-button" onClick={() => restoreNode(node.id)}>
                  Restore
                </button>
              </div>
            ))}

            {failedEdges.map((edge) => (
              <div className="recovery-item" key={`edge-${edge.id}`}>
                <div className="recovery-item-info">
                  <b className="recovery-kind link-kind">LINK</b>
                  <span>
                    {nodes.find((node) => node.id === edge.source)?.data.label || edge.source}
                    {" – "}
                    {nodes.find((node) => node.id === edge.target)?.data.label || edge.target}
                  </span>
                  <small>Failed</small>
                </div>
                <button className="restore-button" onClick={() => restoreEdge(edge.id)}>
                  Restore
                </button>
              </div>
            ))}

            {!failedNodes.length && !failedEdges.length && (
              <p className="empty-state">
                {lastRecovery
                  ? `${lastRecovery}. All failed components are restored.`
                  : "All components operational."}
              </p>
            )}
          </div>
        </section>

        <section className="dash-section blueprint-section">
          <div className="dash-heading">
            <h4>Blueprint</h4>
            <span>{nodes.length}N / {edges.length}L</span>
          </div>
          <Blueprint nodes={nodes} edges={edges} />
        </section>
      </footer>
    </main>
  );
}
