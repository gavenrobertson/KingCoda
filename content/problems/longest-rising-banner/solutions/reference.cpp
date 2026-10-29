class Solution {
public:
    int longestRise(vector<int>& heights) {
        vector<int> tails;
        for (int h : heights) {
            auto it = lower_bound(tails.begin(), tails.end(), h);
            if (it == tails.end()) tails.push_back(h);
            else *it = h;
        }
        return tails.size();
    }
};
