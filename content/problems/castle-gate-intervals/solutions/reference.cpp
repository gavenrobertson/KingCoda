class Solution {
public:
    vector<vector<int>> openStretches(vector<vector<int>>& openings) {
        sort(openings.begin(), openings.end());
        vector<vector<int>> out;
        for (auto& o : openings) {
            if (!out.empty() && o[0] <= out.back()[1]) {
                out.back()[1] = max(out.back()[1], o[1]);
            } else {
                out.push_back(o);
            }
        }
        return out;
    }
};
