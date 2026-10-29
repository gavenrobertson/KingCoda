class Solution {
public:
    vector<int> rotateGuards(vector<int>& posts, int shifts) {
        int n = posts.size();
        int s = shifts % n;
        vector<int> out(n);
        for (int i = 0; i < n; i++) out[(i + s) % n] = posts[i];
        return out;
    }
};
