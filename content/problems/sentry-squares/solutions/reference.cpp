class Solution {
public:
    vector<int> squaredPositions(vector<int>& positions) {
        int n = positions.size();
        vector<int> out(n);
        int lo = 0, hi = n - 1;
        for (int k = n - 1; k >= 0; k--) {
            if (abs(positions[lo]) > abs(positions[hi])) {
                out[k] = positions[lo] * positions[lo];
                lo++;
            } else {
                out[k] = positions[hi] * positions[hi];
                hi--;
            }
        }
        return out;
    }
};
