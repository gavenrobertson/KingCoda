class Solution {
public:
    vector<double> runningMedians(vector<int>& prices) {
        priority_queue<int> low;                            // lower half, max on top
        priority_queue<int, vector<int>, greater<int>> high; // upper half, min on top
        vector<double> out;
        out.reserve(prices.size());
        for (int p : prices) {
            if (low.empty() || p <= low.top()) low.push(p);
            else high.push(p);
            if (low.size() > high.size() + 1) { high.push(low.top()); low.pop(); }
            else if (high.size() > low.size()) { low.push(high.top()); high.pop(); }
            out.push_back(low.size() > high.size() ? low.top() : ((double)low.top() + high.top()) / 2.0);
        }
        return out;
    }
};
