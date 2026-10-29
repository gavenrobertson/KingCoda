class Solution {
public:
    long long trappedWater(vector<int>& walls) {
        int lo = 0, hi = (int)walls.size() - 1;
        long long leftMax = 0, rightMax = 0, water = 0;
        while (lo <= hi) {
            if (leftMax <= rightMax) {
                leftMax = max<long long>(leftMax, walls[lo]);
                water += leftMax - walls[lo++];
            } else {
                rightMax = max<long long>(rightMax, walls[hi]);
                water += rightMax - walls[hi--];
            }
        }
        return water;
    }
};
