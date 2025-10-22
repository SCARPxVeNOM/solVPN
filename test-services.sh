#!/bin/bash
# Test if all solVPN services are running

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  solVPN Service Status Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test Attestor (port 8787)
echo -n "🔍 Attestor (8787)... "
if curl -s http://localhost:8787/state > /dev/null 2>&1; then
  echo "✅ Running"
else
  echo "❌ Not running - Run: bash start-attestor.sh"
fi

# Test Web Dashboard (port 3000)
echo -n "🔍 Web Dashboard (3000)... "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ Running"
else
  echo "❌ Not running - Run: npm run dev -w apps/web"
fi

# Check Node Operator process
echo -n "🔍 Node Operator... "
if pgrep -f "node-operator" > /dev/null; then
  echo "✅ Running"
else
  echo "❌ Not running - Run: bash start-node-operator.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Open http://localhost:3000 in browser"
echo "2. Connect Phantom wallet"
echo "3. Use the operator dashboard!"
echo ""

