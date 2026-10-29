class Solution {
public:
    vector<int> twinCoins(vector<int>& weights, int target) {
        unordered_map<long long, int> first;  // weight -> first position seen
        first.reserve(weights.size() * 2);
        for (int j = 0; j < (int)weights.size(); j++) {
            long long need = (long long)target - weights[j];
            auto it = first.find(need);
            if (it != first.end()) return {it->second, j};
            first.emplace(weights[j], j);
        }
        return {-1, -1};
    }
};
